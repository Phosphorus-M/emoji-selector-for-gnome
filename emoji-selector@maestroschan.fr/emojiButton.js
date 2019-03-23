//this file is part of https://github.com/maoschanz/emoji-selector-for-gnome

const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

/* Import the current extension, mainly because we need to access other files */
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Extension = Me.imports.extension;

const Clipboard = St.Clipboard.get_default();
const CLIPBOARD_TYPE = St.ClipboardType.CLIPBOARD;

//				none	woman					man
const GENDERS =	['',	'\u200D\u2640\uFE0F',	'\u200D\u2642\uFE0F'];
const GENDERS2 = ['👩','👨'];
const TONES = ['', '🏻', '🏼', '🏽', '🏾', '🏿'];

//------------------------------------------------------------------------------

var EmojiButton = class EmojiButton {
	constructor(baseCharacter, category, keywords) {
		this.super_btn = new St.Button({
			style_class: 'EmojisItemStyle',
			style: this.getStyle(),
			can_focus: true,
		});

		this.super_btn.label = baseCharacter;

		let tonable = false;
		let genrable = false;
		let gendered = false;
		for (let j=0; j < keywords.length; j++) {
			if (keywords[j] == 'HAS_TONE') {
				tonable = true;
			} else if (keywords[j] == 'HAS_GENDER') {
				genrable = true;
			} else if (keywords[j] == 'IS_GENDERED') {
				gendered = true;
			}
		}
		this.tags = [tonable, genrable, gendered]
		this.keywords = keywords;

		// Copy the emoji to the clipboard with adequate tags and behavior
		this.super_btn.connect('button-press-event', this.onButtonPress.bind(this));
		this.super_btn.connect('key-press-event', this.onKeyPress.bind(this));

		if (category == null || this.keywords == []) {	return;	}

		// Update the category label on hover, allowing the user to know the
		// name of the emoji he's copying.
		this.super_btn.connect('notify::hover', (a, b) => {
			if (a.hover) {
				category.super_item.label.text = this.keywords[0];
			} else {
				category.super_item.label.text = category.categoryName;
			}
		});
	}

	destroy() {
		//TODO ?
		this.super_btn.destroy();
	}

	getStyle() {
		let fontStyle = 'font-size: ' + Extension.SETTINGS.get_int('emojisize') + 'px;';
		if (Extension.SETTINGS.get_boolean('light-theme')) {
			fontStyle += ' color: #000000;';
		} else {
			fontStyle += ' color: #FFFFFF;';
		}
		return fontStyle;
	}

	onKeyPress(o, e) {
		let symbol = e.get_key_symbol();
		if (symbol == Clutter.Return || symbol == Clutter.KP_Enter) {
			let emojiToCopy = this.getTaggedEmoji();
			let [x, y, mods] = global.get_pointer();
			let majPressed = (mods & Clutter.ModifierType.SHIFT_MASK) != 0;
			let ctrlPressed = (mods & Clutter.ModifierType.CONTROL_MASK) != 0;
			if (majPressed) {
				return this.addToClipboardAndStay(emojiToCopy);
			} else if (ctrlPressed) {
				return this.replaceClipboardAndStay(emojiToCopy);
			} else {
				return this.replaceClipboardAndClose(emojiToCopy);
			}
		}
		return Clutter.EVENT_PROPAGATE;
	}

	//This function is called at each click and copies the emoji to the clipboard.

	//The exact behavior of the method depends on the mouse button used:
	//- left click overwrites clipboard content with the emoji, and closes the menu;
	//- middle click too, but does not close the menu;
	//- right click adds the emoji at the end of the current clipboard content (and
	//  does not close the menu).
	onButtonPress(actor, event) {
		let mouseButton = event.get_button();
		let emojiToCopy = this.getTaggedEmoji();
		if (emojiToCopy == null) { return Clutter.EVENT_PROPAGATE; }

		if (mouseButton == 1) {
			return this.replaceClipboardAndClose(emojiToCopy);
		} else if (mouseButton == 2) {
			return this.replaceClipboardAndStay(emojiToCopy);
		} else if (mouseButton == 3) {
			return this.addToClipboardAndStay(emojiToCopy);
		}
		return Clutter.EVENT_PROPAGATE;
	}

	replaceClipboardAndClose(emojiToCopy) {
		Clipboard.set_text(
			CLIPBOARD_TYPE,
			emojiToCopy
		);
		Extension.GLOBAL_BUTTON.super_btn.menu.close();
		return Clutter.EVENT_STOP;
	}

	replaceClipboardAndStay(emojiToCopy) {
		Clipboard.set_text(
			CLIPBOARD_TYPE,
			emojiToCopy
		);
		return Clutter.EVENT_STOP;
	}

	addToClipboardAndStay(emojiToCopy) {
		Clipboard.get_text(CLIPBOARD_TYPE, function (clipBoard, text) {
			Clipboard.set_text(
				CLIPBOARD_TYPE,
				text + emojiToCopy
			);
		});
		return Clutter.EVENT_STOP;
	}

	// TODO update this old comment and add the tag for symbol
	//This returns an emoji corresponding to .super_btn.label with tags applied to it.
	//`tags` is an array of 3 booleans, which describe how a composite emoji is built:
	//- tonable -> return emoji concatened with the selected skin tone;
	//- genrable -> return emoji concatened with the selected gender;
	//- gendered -> the emoji is already gendered, which modifies the way skin tone is
	//  applied ([man|woman] + [skin tone if any] + [other symbol(s)]).
	//If all tags are false, it returns unmodified .super_btn.label
	getTaggedEmoji() {
		let currentEmoji = this.super_btn.label;
		if(currentEmoji == '') {
			log('Error: not a valid emoji.');
			return;
		}
		let tonable = this.tags[0];
		let genrable = this.tags[1];
		let gendered = this.tags[2];
		let temp = currentEmoji;
		if (tonable) {
			if (gendered) {
				if (temp.includes(GENDERS2[0])) {
					currentEmoji = currentEmoji.replace(GENDERS2[0], GENDERS2[0]+TONES[Extension.SETTINGS.get_int('skin-tone')])
				} else if (temp.includes(GENDERS2[1])) {
					currentEmoji = currentEmoji.replace(GENDERS2[1], GENDERS2[1]+TONES[Extension.SETTINGS.get_int('skin-tone')])
				} else {
					log('Error: ' + GENDERS2[0] + " isn't a valid gender prefix.");
				}
				temp = currentEmoji;
			} else {
				temp += TONES[Extension.SETTINGS.get_int('skin-tone')];
			}
		}
		if (genrable) {
			temp += GENDERS[Extension.SETTINGS.get_int('gender')];
		}
		shiftFor(temp);
		return temp;
	}
};

//-----------------------------------------

function shiftFor(currentEmoji) {
	if (currentEmoji == '') { return; }
	let temp = Convenience.getSettings().get_strv('recently-used');
	for(let i=0; i<temp.length; i++){
		if (temp[i] == currentEmoji) {
			temp.splice(i, 1);
		}
	}
	for(let j=temp.length; j>0; j--){
		temp[j] = temp[j-1];
	}
	temp[0] = currentEmoji;
	Convenience.getSettings().set_strv('recently-used', temp);
	Extension.buildRecents();
	Extension.saveRecents();
	Extension.GLOBAL_BUTTON._onSearchTextChanged();
}


