'use babel';

import { CompositeDisposable } from 'atom';
import FileSystem from 'fs';
import { execSync } from 'child_process';

const CONFIG_FILE_NAME = '.lessconfig';

export default {
	disposables: null,
	activate: function(state) {
		// create disposable
		this.disposables = new CompositeDisposable();

		// Bind commands
		this.disposables.add(atom.commands.add('atom-workspace', {
			'autoless:compile': () => {
				let editor = atom.workspace.getActiveTextEditor();
				if(!editor || !editor.getTitle().endsWith('.less')) {
					atom.notifications.addWarning(`No '.less' file currently selected!`);
					return;
				}
				this.doCompile(editor.getPath());
			},
			'autoless:new-config': () => {
				let editor = atom.workspace.getActiveTextEditor();
				if(!editor || !editor.getTitle().endsWith('.less')) {
					atom.notifications.addWarning(`No '.less' file currently selected!`, {
						detail: 'In order to create a new config, select a less file in the project.'
					});
					return;
				}
				this.createConfig(editor.getPath());
			},
			'autoless:open-config': () => {
				let editor = atom.workspace.getActiveTextEditor();
				if(!editor || !editor.getTitle().endsWith('.less')) {
					atom.notifications.addWarning(`No '.less' file currently selected!`, {
						detail: 'In order to open the config, select a less file in the project.'
					});
					return;
				}
				this.openConfig(editor.getPath());
			}
		}));

		// Bind events to already opened editors
		atom.workspace.getTextEditors().forEach((editor) => {
			this.disposables.add(...this.bindTextEditorEvents(editor));
		});

		// Bind events to new opened editors
		atom.workspace.onDidAddTextEditor((event) => {
			if(event.textEditor) {
				let editor = event.textEditor;
				this.disposables.add(...this.bindTextEditorEvents(editor));
			}
		});
	},
	deactivate: function() {
		this.disposables.dispose();
	},
	serialize: function() {
		return {};
	},
	bindTextEditorEvents: function(editor) {
		// binds save event on editor
		let saveEvent = editor.onDidSave((event) => {
			this.doCompile(event.path, true);
		});
		// binds destroy event on editor
		let destroyEvent = editor.onDidDestroy((event) => {
			// removes binded events on editor
			this.disposables.remove(saveEvent);
			this.disposables.remove(destroyEvent);
		});
		return [saveEvent, destroyEvent];
	},
	doCompile: function(compilePath, auto) {
		// check if it's a less file
		if(compilePath.endsWith('.less')) {
			let path = this.getProjectPath(compilePath);
			if(path) {
				// load config file
				let config = this.loadConfig(path);
				if(config) {
					if(auto && (!config.AUTO_COMPILE || config.AUTO_COMPILE === 'false')) {
						return;
					}
					try {
						execSync(`lessc ${path}/${config.SOURCE_FILE} ${path}/${config.TARGET_FILE}`);
						atom.notifications.addSuccess(`Successfully compiled '${config.SOURCE_FILE}'`);
					}
					catch(err) {
						atom.notifications.addError(`Failed to compile '${config.SOURCE_FILE}' to '${config.TARGET_FILE}'!`, {
							detail: err.message,
							stack: err.stack,
							dismissable: true
						});
					}
				}
			}
		}
	},
	getProjectPath: function(compilePath) {
		// filter project paths by closest match
		return atom.project.getPaths()
			.filter(path => compilePath.startsWith(path))
			.sort((a, b) => a + b)[0];
	},
	loadConfig: function(path) {
		try {
			if(FileSystem.existsSync(`${path}/${CONFIG_FILE_NAME}`)) {
				let data = FileSystem.readFileSync(`${path}/${CONFIG_FILE_NAME}`, 'utf8');
				if(data) {
					let config = {};
					data.split('\n').forEach(line => {
						let match = /(\w+)=([^=]*)/g.exec(line);
						if(match) {
							config[match[1]] = match[2];
						}
					});
					return config;
				}
			}
		}
		catch(err) {
			atom.notifications.addError(`Failed to load '${CONFIG_FILE_NAME}'!`, {
				detail: err.message,
				stack: err.stack,
				dismissable: true
			});
		}
	},
	createConfig: function(configPath) {
		let path = this.getProjectPath(configPath);
		try {
			if(FileSystem.existsSync(`${path}/${CONFIG_FILE_NAME}`)) {
				atom.notifications.addWarning(`A '${CONFIG_FILE_NAME}' already exists for this project!`);
				return;
			}
			FileSystem.appendFileSync(
				`${path}/${CONFIG_FILE_NAME}`,
				`SOURCE_FILE=less/style.less\nTARGET_FILE=css/style.css\nAUTO_COMPILE=true`
			);
			atom.notifications.addSuccess(`Created new '${CONFIG_FILE_NAME}' file`);
		}
		catch(err) {
			atom.notifications.addError(`Failed to load '${CONFIG_FILE_NAME}'!`, {
				detail: err.message,
				stack: err.stack,
				dismissable: true
			});
		}
	},
	openConfig: function(configPath) {
		let path = this.getProjectPath(configPath);
		if(path) {
			atom.workspace.open(`${path}/${CONFIG_FILE_NAME}`);
		}
	}
}
