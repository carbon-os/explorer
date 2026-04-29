package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/carbon-os/arc"
	"github.com/carbon-os/arc/ipc"
	"github.com/carbon-os/arc/window"
)

// ── Logger ────────────────────────────────────────────────────────────────────

type Logger struct {
	enabled bool
	l       *log.Logger
}

func newLogger(enabled bool) *Logger {
	return &Logger{enabled: enabled, l: log.New(os.Stderr, "", log.LstdFlags)}
}
func (lg *Logger) Printf(format string, v ...any) {
	if lg.enabled {
		lg.l.Printf(format, v...)
	}
}
func (lg *Logger) Fatalf(format string, v ...any) { lg.l.Fatalf(format, v...) }

var logger *Logger

// ── Data types (mirroring types.ts) ──────────────────────────────────────────

type FileEntry struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	IsDir    bool   `json:"isDir"`
	Size     int64  `json:"size"`
	Modified int64  `json:"modified"` // unix ms
	Ext      string `json:"ext"`      // lowercase, no dot
}

type DriveInfo struct {
	Label      string `json:"label"`
	Path       string `json:"path"`
	TotalBytes uint64 `json:"totalBytes,omitempty"`
	FreeBytes  uint64 `json:"freeBytes,omitempty"`
	Removable  bool   `json:"removable,omitempty"`
}

type SpecialDirs struct {
	Home      string `json:"home"`
	Desktop   string `json:"desktop,omitempty"`
	Documents string `json:"documents,omitempty"`
	Downloads string `json:"downloads,omitempty"`
	Pictures  string `json:"pictures,omitempty"`
	Music     string `json:"music,omitempty"`
	Videos    string `json:"videos,omitempty"`
}

// ── Explorer server ───────────────────────────────────────────────────────────

type explorerServer struct {
	ipcMain *ipc.IPC
}

// send marshals v to JSON and sends it on channel.
func (s *explorerServer) send(channel string, v any) {
	b, err := json.Marshal(v)
	if err != nil {
		logger.Printf("[ex] marshal error on %q: %v", channel, err)
		return
	}
	s.ipcMain.SendBytes(channel, b)
}

// opResult is the standard success/error envelope.
func (s *explorerServer) opResult(op string, err error) {
	if err != nil {
		s.send("fs.op.result", map[string]any{"op": op, "success": false, "error": err.Error()})
	} else {
		s.send("fs.op.result", map[string]any{"op": op, "success": true})
	}
}

// ── fs.getSpecialDirs ─────────────────────────────────────────────────────────

func (s *explorerServer) handleGetSpecialDirs(_ ipc.Message) {
	home, err := os.UserHomeDir()
	if err != nil {
		logger.Printf("[ex] UserHomeDir: %v", err)
		home = "/"
	}

	dirs := SpecialDirs{Home: home}

	switch runtime.GOOS {
	case "windows":
		dirs.Desktop   = filepath.Join(home, "Desktop")
		dirs.Documents = filepath.Join(home, "Documents")
		dirs.Downloads = filepath.Join(home, "Downloads")
		dirs.Pictures  = filepath.Join(home, "Pictures")
		dirs.Music     = filepath.Join(home, "Music")
		dirs.Videos    = filepath.Join(home, "Videos")
	case "darwin":
		dirs.Desktop   = filepath.Join(home, "Desktop")
		dirs.Documents = filepath.Join(home, "Documents")
		dirs.Downloads = filepath.Join(home, "Downloads")
		dirs.Pictures  = filepath.Join(home, "Pictures")
		dirs.Music     = filepath.Join(home, "Music")
		dirs.Videos    = filepath.Join(home, "Movies")
	default: // Linux / BSD
		dirs.Desktop   = xdgDir("DESKTOP",   filepath.Join(home, "Desktop"))
		dirs.Documents = xdgDir("DOCUMENTS", filepath.Join(home, "Documents"))
		dirs.Downloads = xdgDir("DOWNLOAD",  filepath.Join(home, "Downloads"))
		dirs.Pictures  = xdgDir("PICTURES",  filepath.Join(home, "Pictures"))
		dirs.Music     = xdgDir("MUSIC",     filepath.Join(home, "Music"))
		dirs.Videos    = xdgDir("VIDEOS",    filepath.Join(home, "Videos"))
	}

	// Only include paths that actually exist.
	dirs.Desktop   = existsOrEmpty(dirs.Desktop)
	dirs.Documents = existsOrEmpty(dirs.Documents)
	dirs.Downloads = existsOrEmpty(dirs.Downloads)
	dirs.Pictures  = existsOrEmpty(dirs.Pictures)
	dirs.Music     = existsOrEmpty(dirs.Music)
	dirs.Videos    = existsOrEmpty(dirs.Videos)

	logger.Printf("[ex] specialDirs: %+v", dirs)
	s.send("fs.specialDirs.result", dirs)
}

func xdgDir(key, fallback string) string {
	if v := os.Getenv("XDG_" + key + "_DIR"); v != "" {
		return v
	}
	return fallback
}

func existsOrEmpty(p string) string {
	if p == "" {
		return ""
	}
	if _, err := os.Stat(p); err != nil {
		return ""
	}
	return p
}

// ── fs.getDrives ──────────────────────────────────────────────────────────────

func (s *explorerServer) handleGetDrives(_ ipc.Message) {
	s.send("fs.drives.result", map[string]any{"drives": listDrives()})
}

func listDrives() []DriveInfo {
	var drives []DriveInfo

	switch runtime.GOOS {

	case "windows":
		for _, letter := range "ABCDEFGHIJKLMNOPQRSTUVWXYZ" {
			root := string(letter) + ":\\"
			if _, err := os.Stat(root); err != nil {
				continue
			}
			total, free := diskSpace(root)
			drives = append(drives, DriveInfo{
				Label:      fmt.Sprintf("%s: Drive", string(letter)),
				Path:       root,
				TotalBytes: total,
				FreeBytes:  free,
			})
		}

	case "darwin":
		vols, err := os.ReadDir("/Volumes")
		if err == nil {
			for _, v := range vols {
				p := "/Volumes/" + v.Name()
				total, free := diskSpace(p)
				drives = append(drives, DriveInfo{
					Label: v.Name(), Path: p,
					TotalBytes: total, FreeBytes: free,
				})
			}
		}

	default: // Linux
		// Parse /proc/mounts for physical/virtual fs we care about.
		drives = append(drives, func() DriveInfo {
			total, free := diskSpace("/")
			return DriveInfo{Label: "/ Root", Path: "/", TotalBytes: total, FreeBytes: free}
		}())
		// Also surface common mount points if they exist.
		for _, mp := range []string{"/home", "/data", "/media", "/mnt"} {
			if _, err := os.Stat(mp); err == nil {
				total, free := diskSpace(mp)
				if total > 0 {
					drives = append(drives, DriveInfo{
						Label:      mp,
						Path:       mp,
						TotalBytes: total,
						FreeBytes:  free,
					})
				}
			}
		}
	}

	return drives
}

// ── fs.list ───────────────────────────────────────────────────────────────────

func (s *explorerServer) handleList(msg ipc.Message) {
	var req struct {
		Path string `json:"path"`
	}
	if err := json.Unmarshal(msg.Bytes(), &req); err != nil {
		logger.Printf("[ex] fs.list bad JSON: %v", err)
		return
	}
	logger.Printf("[ex] fs.list %q", req.Path)

	entries, err := listDir(req.Path)
	if err != nil {
		logger.Printf("[ex] fs.list error: %v", err)
		s.send("fs.list.result", map[string]any{"path": req.Path, "entries": []any{}})
		return
	}

	s.send("fs.list.result", map[string]any{"path": req.Path, "entries": entries})
}

func listDir(path string) ([]FileEntry, error) {
	infos, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}

	entries := make([]FileEntry, 0, len(infos))
	for _, info := range infos {
		fi, err := info.Info()
		if err != nil {
			continue
		}

		name := info.Name()
		full := filepath.Join(path, name)

		ext := ""
		if !info.IsDir() {
			ext = strings.ToLower(strings.TrimPrefix(filepath.Ext(name), "."))
		}

		entries = append(entries, FileEntry{
			Name:     name,
			Path:     full,
			IsDir:    info.IsDir(),
			Size:     fi.Size(),
			Modified: fi.ModTime().UnixMilli(),
			Ext:      ext,
		})
	}
	return entries, nil
}

// ── fs.open ───────────────────────────────────────────────────────────────────

func (s *explorerServer) handleOpen(msg ipc.Message) {
	var req struct {
		Path string `json:"path"`
	}
	if err := json.Unmarshal(msg.Bytes(), &req); err != nil {
		return
	}
	logger.Printf("[ex] fs.open %q", req.Path)
	openWithDefault(req.Path)
}

func openWithDefault(path string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", path)
	case "darwin":
		cmd = exec.Command("open", path)
	default:
		cmd = exec.Command("xdg-open", path)
	}
	if err := cmd.Start(); err != nil {
		logger.Printf("[ex] open %q: %v", path, err)
	}
}

// ── fs.rename ─────────────────────────────────────────────────────────────────

func (s *explorerServer) handleRename(msg ipc.Message) {
	var req struct {
		OldPath string `json:"oldPath"`
		NewName string `json:"newName"`
	}
	if err := json.Unmarshal(msg.Bytes(), &req); err != nil {
		s.opResult("fs.rename", fmt.Errorf("bad request"))
		return
	}

	newPath := filepath.Join(filepath.Dir(req.OldPath), req.NewName)
	logger.Printf("[ex] fs.rename %q → %q", req.OldPath, newPath)
	s.opResult("fs.rename", os.Rename(req.OldPath, newPath))
}

// ── fs.delete ─────────────────────────────────────────────────────────────────

func (s *explorerServer) handleDelete(msg ipc.Message) {
	var req struct {
		Paths []string `json:"paths"`
	}
	if err := json.Unmarshal(msg.Bytes(), &req); err != nil {
		s.opResult("fs.delete", fmt.Errorf("bad request"))
		return
	}

	for _, p := range req.Paths {
		logger.Printf("[ex] fs.delete %q", p)
		if err := os.RemoveAll(p); err != nil {
			s.opResult("fs.delete", err)
			return
		}
	}
	s.opResult("fs.delete", nil)
}

// ── fs.mkdir ──────────────────────────────────────────────────────────────────

func (s *explorerServer) handleMkdir(msg ipc.Message) {
	var req struct {
		Path string `json:"path"`
		Name string `json:"name"`
	}
	if err := json.Unmarshal(msg.Bytes(), &req); err != nil {
		s.opResult("fs.mkdir", fmt.Errorf("bad request"))
		return
	}

	// Pick a unique name: "New Folder", "New Folder (2)", etc.
	base   := filepath.Join(req.Path, req.Name)
	target := base
	for i := 2; ; i++ {
		if _, err := os.Stat(target); os.IsNotExist(err) {
			break
		}
		target = fmt.Sprintf("%s (%d)", base, i)
	}

	logger.Printf("[ex] fs.mkdir %q", target)
	s.opResult("fs.mkdir", os.MkdirAll(target, 0o755))
}

// ── fs.copy ───────────────────────────────────────────────────────────────────

func (s *explorerServer) handleCopy(msg ipc.Message) {
	var req struct {
		Sources []string `json:"sources"`
		Dest    string   `json:"dest"`
	}
	if err := json.Unmarshal(msg.Bytes(), &req); err != nil {
		s.opResult("fs.copy", fmt.Errorf("bad request"))
		return
	}

	for _, src := range req.Sources {
		logger.Printf("[ex] fs.copy %q → %q", src, req.Dest)
		if err := copyPath(src, req.Dest); err != nil {
			s.opResult("fs.copy", err)
			return
		}
	}
	s.opResult("fs.copy", nil)
}

func copyPath(src, destDir string) error {
	info, err := os.Stat(src)
	if err != nil {
		return err
	}
	dst := filepath.Join(destDir, filepath.Base(src))
	if info.IsDir() {
		return copyDir(src, dst)
	}
	return copyFile(src, dst)
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

func copyDir(src, dst string) error {
	if err := os.MkdirAll(dst, 0o755); err != nil {
		return err
	}
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	for _, e := range entries {
		if e.IsDir() {
			if err := copyDir(filepath.Join(src, e.Name()), filepath.Join(dst, e.Name())); err != nil {
				return err
			}
		} else {
			if err := copyFile(filepath.Join(src, e.Name()), filepath.Join(dst, e.Name())); err != nil {
				return err
			}
		}
	}
	return nil
}

// ── fs.move ───────────────────────────────────────────────────────────────────

func (s *explorerServer) handleMove(msg ipc.Message) {
	var req struct {
		Sources []string `json:"sources"`
		Dest    string   `json:"dest"`
	}
	if err := json.Unmarshal(msg.Bytes(), &req); err != nil {
		s.opResult("fs.move", fmt.Errorf("bad request"))
		return
	}

	for _, src := range req.Sources {
		dst := filepath.Join(req.Dest, filepath.Base(src))
		logger.Printf("[ex] fs.move %q → %q", src, dst)

		if err := os.Rename(src, dst); err != nil {
			// Cross-device move: copy then remove.
			if err2 := copyPath(src, req.Dest); err2 != nil {
				s.opResult("fs.move", err2)
				return
			}
			if err2 := os.RemoveAll(src); err2 != nil {
				s.opResult("fs.move", err2)
				return
			}
		}
	}
	s.opResult("fs.move", nil)
}

// ── Disk space (best-effort, no build tags) ───────────────────────────────────
// Implemented in diskspace_windows.go / diskspace_unix.go via build tags.
// Signature: func diskSpace(path string) (total, free uint64)

// ── Main ──────────────────────────────────────────────────────────────────────

func main() {
	verbose := flag.Bool("log", false, "enable debug logging")
	flag.Parse()
	if os.Getenv("EX_LOG") != "" {
		*verbose = true
	}
	logger = newLogger(*verbose)

	app := arc.NewApp(arc.AppConfig{
		Title:    "Explorer",
		Logging:  false,
		Renderer: arc.RendererConfig{Path: "/Users/galaxy/Desktop/arc/libarc/build/bin/arc-host"},
	})

	app.OnReady(func() {
		win := app.NewBrowserWindow(window.Config{
			Title:  "Explorer",
			Width:  1100,
			Height: 680,
			Debug:  true,
		})

		ipcMain := win.IPC()                          // ← single reference
		srv := &explorerServer{ipcMain: ipcMain}      // ← same reference passed in

		ipcMain.On("fs.getSpecialDirs", srv.handleGetSpecialDirs)
		ipcMain.On("fs.getDrives",      srv.handleGetDrives)
		ipcMain.On("fs.list",           srv.handleList)
		ipcMain.On("fs.open",           srv.handleOpen)
		ipcMain.On("fs.rename",         srv.handleRename)
		ipcMain.On("fs.delete",         srv.handleDelete)
		ipcMain.On("fs.mkdir",          srv.handleMkdir)
		ipcMain.On("fs.copy",           srv.handleCopy)
		ipcMain.On("fs.move",           srv.handleMove)

		win.OnReady(func() {
			win.LoadFile("frontend/dist/index.html")
		})
	})

	app.OnClose(func() bool { return true })

	if err := app.Run(); err != nil {
		logger.Fatalf("arc: %v", err)
	}
}