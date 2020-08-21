# Autoless
Less Compiler Atom Plugin
<br>
<br>

### Setup

Clone the latest version.

```bash
git clone https://github.com/typable/autoless.git
```

The following node modules are required in order to compile less.

```bash
npm i -g less
npm i -g less-plugin-clean-css
```

Now we need to tell Atom where to find the plugin.

```bash
apm link <autoless-path>
```

After restarting Atom, the plugin should be visible under `Packages`.
<br>
<br>

### Configurations

For every project a new *.lessconfig* is required. It's located in the root path
of your project. To create it automatically go to `Packages > Autoless > New Config`.

|Property|Description|
|---|---|
|`SOURCE_FILE`|The location of your *style.less* file|
|`TARGET_FILE`|The location of your *style.css* file|
|`AUTO_COMPILE`|If true, it compiles on save *(Ctrl + S)*|
<br>

**Notice: For all actions, at least one *.less* editor tab must be open!**
<br>
<br>

### Settings

|Property|Description|
|---|---|
|`minify`|If true, **all projects** get compiled minified|
