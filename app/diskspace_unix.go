//go:build !windows

package main

import "syscall"

func diskSpace(path string) (total, free uint64) {
	var s syscall.Statfs_t
	if err := syscall.Statfs(path, &s); err != nil {
		return 0, 0
	}
	blockSize := uint64(s.Bsize)
	total = s.Blocks * blockSize
	free  = s.Bavail * blockSize
	return
}