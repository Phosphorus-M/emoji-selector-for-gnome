// extension.js (https://github.com/maoschanz/emoji-selector-for-gnome)

/*
	Copyright 2017-2020 Romain F. T.

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const Shell = imports.gi.Shell;

// it is needed to grab the focus for the search entry
const Mainloop = imports.mainloop;

// for the keybinding
const Meta = imports.gi.Meta;

/* Import PanelMenu and PopupMenu */
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const Clipboard = St.Clipboard.get_default();
const CLIPBOARD_TYPE = St.ClipboardType.CLIPBOARD;

/* Stuffs for settings, translations etc. */
const Gettext = imports.gettext.domain('emoji-selector');
const _ = Gettext.gettext;

// Retrocompatibility
const ShellVersion = imports.misc.config.PACKAGE_VERSION;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const SkinTonesBar = Me.imports.emojiOptionsBar.SkinTonesBar;
const EmojiCategory = Me.imports.emojiCategory.EmojiCategory;
const EmojiSearchItem = Me.imports.emojiSearchItem.EmojiSearchItem;

//------------------------------------------------------------------------------

var CAT_LABELS;

const CAT_ICONS = [
	'face-smile-symbolic', //'emoji-body-symbolic',
	'emoji-people-symbolic',
	'emoji-nature-symbolic',
	'emoji-food-symbolic',
	'emoji-travel-symbolic',
	'emoji-activities-symbolic',
	'emoji-objects-symbolic',
	'emoji-symbols-symbolic',
	'emoji-flags-symbolic'
];

var SETTINGS;
let SIGNAUX = [];

// Global variable : GLOBAL_BUTTON to click in the topbar
var GLOBAL_BUTTON;

// These global variables are used to store some static settings
let POSITION;

//------------------------------------------------------------------------------

/*
 * This is the main class of this extension, corresponding to the button in the
 * top panel and its menu.
 */
class EmojisMenu {

	constructor() {
		this.super_btn = new PanelMenu.Button(0.0, _("Emoji Selector"), false);
		let box = new St.BoxLayout();
		let icon = new St.Icon({
			icon_name: 'face-cool-symbolic',
			style_class: 'system-status-icon emotes-icon'
		});
		box.add_child(icon);
		if (this._shellVersion < 40) {
			box.add_child(PopupMenu.arrowIcon(St.Side.BOTTOM));
		}
		this._permanentItems = 0;
		this._activeCat = -1;

		this.super_btn.add_child(box);
		this.super_btn.visible = SETTINGS.get_boolean('always-show');

		// initializing categories
		let nbColumns = SETTINGS.get_int('nbcols');
		this._createAllCategories(nbColumns);

		// initializing this._buttonMenuItem
		this._renderPanelMenuHeaderBox();

		this.searchItem = new EmojiSearchItem();

		//initializing the "recently used" buttons
		let recentlyUsed = this._recentlyUsedInit();

		if (POSITION === 'top') {
			this.super_btn.menu.addMenuItem(this._buttonMenuItem);
			this._permanentItems++;
			this.super_btn.menu.addMenuItem(this.searchItem.super_item);
			this._permanentItems++;
			this.super_btn.menu.addMenuItem(this.searchItem.recentlyUsedItem);
			this._permanentItems++;
		}
		//----------------------------------------------------------------------
		this._addAllCategories();
		//----------------------------------------------------------------------
		if (POSITION === 'bottom') {
			this.super_btn.menu.addMenuItem(this.searchItem.recentlyUsedItem);
			this._permanentItems++;
			this.super_btn.menu.addMenuItem(this.searchItem.super_item);
			this._permanentItems++;
			this.super_btn.menu.addMenuItem(this._buttonMenuItem);
			this._permanentItems++;
		}

		this.super_btn.menu.connect(
			'open-state-changed',
			this._onOpenStateChanged.bind(this)
		);

		if (SETTINGS.get_boolean('use-keybinding')) {
			this._bindShortcut();
		}
	}

	_connectSignals() {
	}

	disconnectSignals() {
	}

	updateStyle() {
		this.searchItem.updateStyleRecents();
		this.emojiCategories.forEach(function(c) {
			c.emojiButtons.forEach(function(b) {
				b.updateStyle();
			});
		});
	}

	toggle() {
		this.super_btn.menu.toggle();
	}

	// Executed when the user opens/closes the menu, the main goals are to clear
	// and to focus the search entry.
	_onOpenStateChanged(self, open) {
		this.super_btn.visible = open || SETTINGS.get_boolean('always-show');
		this.clearCategories();
		this.searchItem.searchEntry.set_text('');
		// this.unloadCategories();

		let a = Mainloop.timeout_add(20, () => {
			if (open) {
				global.stage.set_key_focus(this.searchItem.searchEntry);
			}
			Mainloop.source_remove(a);
		});
	}

//	unloadCategories() { // XXX
//		for (let i=1; i<this.emojiCategories.length; i++) {
//			this.emojiCategories[i].unload();
//		}
//	}

	// Creates all categories (buttons & submenu menuitems), empty for now.
	_createAllCategories(nbColumns) {
		this.emojiCategories = [];

		/* creating new categories, with emojis not loaded yet */
		for (let i = 0; i < 9; i++) {
			this.emojiCategories[i] = new EmojiCategory(CAT_LABELS[i], CAT_ICONS[i], i, nbColumns);
		}
	}

	// Adds all submenu-menuitems to the extension interface. These items are
	// hidden, and will be visible only when the related category is opened.
	_addAllCategories() {
		for (let i = 0; i < 9; i++) {
			this.super_btn.menu.addMenuItem(this.emojiCategories[i].super_item);
		}
	}

	// Adds categories' buttons to the extension interface
	_renderPanelMenuHeaderBox() {
		this._buttonMenuItem = new PopupMenu.PopupBaseMenuItem({
			reactive: false,
			can_focus: false
		});
		this.categoryButton = [];
		for (let i=0; i<this.emojiCategories.length; i++) {
			this._buttonMenuItem.actor.add_child(this.emojiCategories[i].getButton());
		}
	}

	// Cleans the interface & close the opened category (if any). Called from the
	// outside, be careful.
	clearCategories() {
		// removing the style class of previously opened category's button
		for (let i = 0; i< 9; i++) {
			this.emojiCategories[i].getButton().set_checked(false);
		}

		let items = this.super_btn.menu._getMenuItems();

		// closing and hiding any opened category
		if (POSITION == 'top') {
			for (let i = this._permanentItems; i < items.length; i++) {
				items[i].setSubmenuShown(false);
				items[i].actor.visible = false;
			}
		} else { // if (POSITION == 'bottom') {
			for (let i = 0; i < (items.length - this._permanentItems); i++) {
				items[i].setSubmenuShown(false);
				items[i].actor.visible = false;
			}
		}

		this._activeCat = -1;
		this._onSearchTextChanged(); // XXX not optimal
	}

	// Wrapper calling EmojiSearchItem's _onSearchTextChanged method
	_onSearchTextChanged() {
		this.searchItem._onSearchTextChanged();
	}

	_bindShortcut() {
		Main.wm.addKeybinding(
			'emoji-keybinding',
			Convenience.getSettings(),
			Meta.KeyBindingFlags.NONE,
			Shell.ActionMode.ALL,
			this.toggle.bind(this)
		);
	}

//	destroy() { // XXX ?
//		this.unloadCategories();
//		for (let i=1; i<this.emojiCategories.length; i++) {
//			this.emojiCategories[i].destroy();
//		}
//	}
};

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------

function init() {
	Convenience.initTranslations('emoji-selector');
	try {
		let theme = imports.gi.Gtk.IconTheme.get_default();
		theme.append_search_path(Me.path + '/icons');
	} catch (e) {
		// Appending bullshit to the icon theme path is deprecated, but 18.04
		// users don't have the icons so i do it anyway.
	}
}

//------------------------------------------------------------------------------

function enable() {
	SETTINGS = Convenience.getSettings();
	POSITION = SETTINGS.get_string('position');
	/* TODO paramètres restants à rendre dynamiques
	 * emoji-keybinding (tableau de chaînes), pourri de toutes manières
	 * nbcols (int), rebuild nécessaire
	 * position (chaîne) impossible tout court ?
	*/

	// This variable is assigned here because init() wouldn't have provided
	// gettext yet if it was done at the top level of the file.
	CAT_LABELS = [
		_("Smileys & Body"),
		_("Peoples & Clothing"),
		_("Animals & Nature"),
		_("Food & Drink"),
		_("Travel & Places"),
		_("Activities & Sports"),
		_("Objects"),
		_("Symbols"),
		_("Flags")
	];

	GLOBAL_BUTTON = new EmojisMenu();

	// about addToStatusArea :
	// - 'EmojisMenu' is an id
	// - 0 is the position
	// - `right` is the box where we want our GLOBAL_BUTTON to be displayed (left/center/right)
	Main.panel.addToStatusArea('EmojisMenu', GLOBAL_BUTTON.super_btn, 0, 'right');

	SIGNAUX[0] = SETTINGS.connect('changed::emojisize', () => { updateStyle(); });
	SIGNAUX[1] = SETTINGS.connect('changed::always-show', () => {
		GLOBAL_BUTTON.super_btn.actor.visible = SETTINGS.get_boolean('always-show');
	});
	SIGNAUX[2] = SETTINGS.connect('changed::use-keybinding', (z) => {
		if (z.get_boolean('use-keybinding')) {
			Main.wm.removeKeybinding('emoji-keybinding');
			GLOBAL_BUTTON._bindShortcut();
		} else {
			Main.wm.removeKeybinding('emoji-keybinding');
		}
	});
}

//------------------------------------------------------------------------------

function disable() {
	// we need to save labels of the recent emojis for the next session
	GLOBAL_BUTTON.searchItem.saveRecents();

	if (SETTINGS.get_boolean('use-keybinding')) {
		Main.wm.removeKeybinding('emoji-keybinding');
	}

	SETTINGS.disconnect(SIGNAUX[0]);
	SETTINGS.disconnect(SIGNAUX[1]);
	SETTINGS.disconnect(SIGNAUX[2]);

	GLOBAL_BUTTON.super_btn.destroy();
//	GLOBAL_BUTTON.destroy();
}

//------------------------------------------------------------------------------
