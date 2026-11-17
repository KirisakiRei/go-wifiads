package portal

import (
	"embed"
	"io/fs"
)

//go:embed templates/*.html static/css/*.css static/js/*.js static/img/*.svg static/admin
var files embed.FS

// Templates exposes the parsed template sources.
func Templates() fs.FS {
	sub, err := fs.Sub(files, "templates")
	if err != nil {
		panic(err)
	}
	return sub
}

// Static exposes the first-party CSS, JavaScript and image assets. Nothing is
// loaded from a CDN: the portal is rendered before the guest is authenticated,
// so the walled garden would block third-party requests anyway.
func Static() fs.FS {
	sub, err := fs.Sub(files, "static")
	if err != nil {
		panic(err)
	}
	return sub
}
