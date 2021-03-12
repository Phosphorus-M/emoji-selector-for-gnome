all: build install

build:
	./update-and-compile-translations.sh
	glib-compile-schemas ./emoji-selector@maestroschan.fr/schemas

install:

	echo "Installing extension files in $INSTALL_DIR/emoji-selector@maestroschan.fr"
	cp -r emoji-selector@maestroschan.fr ~/.local/share/gnome-shell/extensions

	echo "Done."
	exit 0