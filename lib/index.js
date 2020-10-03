'use babel';

import fs from 'fs';
import { execSync } from 'child_process';
import { CompositeDisposable } from 'atom';

const CONFIG_FILE_NAME = '.lessconfig';

let disposables;

function activate(state) {
	disposables = new CompositeDisposable();

	for(let editor of atom.workspace.getTextEditors()) {
		disposables.add(...bind_editor_events(editor));
	}

	atom.workspace.onDidAddTextEditor(function(event) {
		let editor = event.textEditor;
		if(editor) {
			disposables.add(...bind_editor_events(editor));
		}
	});

	disposables.add(atom.commands.add('atom-workspace', {
		'autoless:compile': function() {
			perform(compile);
		},
		'autoless:new-config': function() {
			let path = get_path();
			if(path && path.project) {
				create_config(path.project);
			}
		},
		'autoless:open-config': function() {
			let path = get_path();
			if(path && path.project) {
				open_config(path.project);
			}
		}
	}));
}

function deactivate() {
	disposables.dispose();
}

function serialize() {
	return {};
}

export default {
	config: {
		'minify': {
			title: 'Minify',
			description: 'Minify css file',
			type: 'boolean',
			default: false
		},
		'auto-compile': {
			title: 'Autocompile',
			description: 'Compile on save',
			type: 'boolean',
			default: true
		},
		'source-file': {
			title: 'Source File',
			description: 'Location for the main less file',
			type: 'string',
			default: 'less/style.less'
		},
		'target-file': {
			title: 'Target File',
			description: 'Location for the main css file',
			type: 'string',
			default: 'css/style.css'
		}
	},
	activate,
	deactivate,
	serialize
};

function perform(task, args) {
	let path = get_path();
	if(path && path.project && path.file) {
		let config = load_config(path.project);
		if(config) {
			if(validate_config(config)) {
				task(config, { path, ...args });
			}
		}
	}
}

function compile(config, { path, auto = false }) {
	if(path.file.endsWith('.less')) {
		if(auto && !config.auto_compile) {
			return;
		}
		try {
			let command = [
				`lessc`,
				`${path.project}/${config.source_file}`,
				`${path.project}/${config.target_file}`
			];
			let minify = config.minify ? ' --clean-css' : '';
			execSync(command.join(' ') + minify, { encoding: 'utf8' });
			atom.notifications.addSuccess(`Autoless: Successfully compiled '${config.source_file}'`);
		}
		catch(error) {
			let options = {};
			let message = format_message(error.message);
			let reference = find_error_reference(config, path, message);
			if(reference) {
				options.buttons = [
					{
						text: 'Jump to line',
						onDidClick: function() {
							jump_to(reference);
						}
					}
				];
			}
			atom.notifications.addError(`Autoless: Failed to compile '${config.source_file}'!`, {
				detail: message,
				stack: format_message(error.stack),
				dismissable: true,
				...options
			});
		}
	}
}

function bind_editor_events(editor) {
	let save_event = editor.onDidSave(function() {
		perform(compile, { auto: true });
	});
	let destroy_event = editor.onDidDestroy(function() {
		disposables.remove(save_event);
		disposables.remove(destroy_event);
	});
	return [save_event, destroy_event];
}

function create_config(path) {
	if(exists_config(path)) {
		atom.notifications.addWarning(`Autoless: A '${CONFIG_FILE_NAME}' already exists for this project!`);
		open_config(path);
		return;
	}
	let config = [
		`MINIFY=${atom.config.get('autoless.minify')}`,
		`AUTO_COMPILE=${atom.config.get('autoless.auto-compile')}`,
		`SOURCE_FILE=${atom.config.get('autoless.source-file')}`,
		`TARGET_FILE=${atom.config.get('autoless.target-file')}`
	];
	try {
		fs.appendFileSync(`${path}/${CONFIG_FILE_NAME}`, config.join('\n'));
		atom.notifications.addSuccess(`Autoless: Created new '${CONFIG_FILE_NAME}' file`);
	}
	catch(error) {
		atom.notifications.addError(`Autoless: Failed to create '${CONFIG_FILE_NAME}' file!`, {
			detail: format_message(error.message),
			stack: format_message(error.stack),
			dismissable: true
		});
	}
}

function get_path() {
	let editor = atom.workspace.getActiveTextEditor();
	if(!editor) {
		atom.notifications.addWarning(`Autoless: Unable to determine project!`, {
			detail: 'At least one file must be active opened to detect the current project.'
		});
		return null;
	}
	let path = atom.project.relativizePath(editor.getPath());
	return {
		project: path[0],
		file: path[1]
	};
}

function load_config(path) {
	if(exists_config(path)) {
		try {
			let data = fs.readFileSync(`${path}/${CONFIG_FILE_NAME}`, 'utf8');
			if(data) {
				return parse_properties(data);
			}
		}
		catch(error) {
			atom.notifications.addError(`Autoless: Failed to load '${CONFIG_FILE_NAME}'!`, {
				detail: format_message(error.message),
				stack: format_message(error.stack),
				dismissable: true
			});
		}
	}
	return null;
}

function open_config(path) {
	if(!exists_config(path)) {
		atom.notifications.addWarning(`Autoless: A '${CONFIG_FILE_NAME}' does not exist for this project!`);
		return;
	}
	atom.workspace.open(`${path}/${CONFIG_FILE_NAME}`);
}

function exists_config(path) {
	try {
		return fs.existsSync(`${path}/${CONFIG_FILE_NAME}`);
	}
	catch(error) {
		console.debug('Failed to determine if config file exists!', error);
	}
	return false;
}

function validate_config(config) {
	let error_list = [];
	let { minify, auto_compile, source_file, target_file } = config;
	if(typeof minify !== 'boolean') {
		error_list.push('MINIFY');
	}
	if(typeof auto_compile !== 'boolean') {
		error_list.push('AUTO_COMPILE');
	}
	if(typeof source_file !== 'string') {
		error_list.push('SOURCE_FILE');
	}
	if(typeof target_file !== 'string') {
		error_list.push('TARGET_FILE');
	}
	if(error_list.length > 0) {
		atom.notifications.addWarning(`Autoless: Unable to compile, due to invalid '${CONFIG_FILE_NAME}'!`, {
			detail: `The following properties are invalid:\n${format_message(error_list)}`,
			dismissable: true
		});
		return false;
	}
	return true;
}

function format_message(message) {
	if(Array.isArray(message)) {
		let result = '';
		for(let item of message) {
			result += `   - ${item}\n`;
		}
		return result;
	}
	return message.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

function parse_properties(data) {
	let config = {};
	for(let line of data.split('\n')) {
		let match = /(\w+)=([^=]*)/g.exec(line);
		if(match) {
			let key = match[1].toLowerCase();
			let value = match[2];
			if(/^(true|false)$/g.test(value)) {
				value = value === 'true';
			}
			else if(/^[\d]+$/g.test(value)) {
				value = parseInt(value);
			}
			else if(/^[\d\.]+$/g.test(value)) {
				value = parseFloat(value);
			}
			config[key] = value;
		}
	}
	return config;
}

function find_error_reference(config, path, message) {
	if(message) {
		try {
			let line_list = message.split('\n');
			if(line_list.length >= 2) {
				let file_path = `${replace_quote(path.project)}`;
				let exp = new RegExp(`(${file_path}[^\\s]+) on line (\\d+), column (\\d+):`, 'g');
				let match = exp.exec(line_list[1]);
				if(match) {
					let [ , file, row, column ] = match;
					return {
						path: file,
						row: parseInt(row) - 1,
						column: parseInt(column) - 1
					};
				}
			}
		}
		catch(error) {
			console.debug('Failed to determine reference!', error);
		}
	}
	return null;
}

function jump_to({ path, row, column }) {
	atom.workspace.open(path, {
		initialLine: row,
		initialColumn: column
	});
}

function replace_quote(string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
