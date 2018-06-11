'use babel'

import {CompositeDisposable} from 'atom'

export default {
  dependenciesInstalled: null,
  goget: null,
  goconfig: null,
  formatter: null,
  subscriptions: null,
  toolCheckComplete: null,

  activate () {
    this.subscriptions = new CompositeDisposable()
    require('atom-package-deps').install('gounit').then(() => {
      this.dependenciesInstalled = true
      return this.dependenciesInstalled
    }).catch((e) => {
      console.log(e)
    })
    this.subscriptions.add(atom.commands.add('atom-workspace', 'gounit:generate', () => this.generate()))
  },

  deactivate () {
    if (this.subscriptions) {
      this.subscriptions.dispose()
    }
    this.subscriptions = null
    this.goget = null
    this.goconfig = null
    this.dependenciesInstalled = null
    this.toolCheckComplete = null
  },

  consumeGoconfig (service) {
    this.goconfig = service
    this.checkForTool()
  },

  consumeGoget (service) {
    this.goget = service
    this.checkForTool()
  },

  checkForTool () {
    if (!this.toolCheckComplete && this.goconfig && this.goget) {
      let config = this.goconfig
      let options = {env: config.environment()}
      config.locator.findTool('gounit', options).then((cmd) => {
        this.toolCheckComplete = true
        if (!cmd) {
          let goget = this.goget
          goget.get({
            name: 'gounit',
            packageName: 'gounit',
            packagePath: 'github.com/hexdigest/gounit/...',
            type: 'missing'
          }).then(() => {
            return true
          }).catch((e) => {
            console.log(e)
          })
        }
      })
    }
  },

  getLocatorOptions (editor) {
    let options = {}
    let p = atom.project.getPaths()
    if (p) {
      options.directory = p
    }

    return options
  },

  getExecutorOptions (editor) {
    let o = this.getLocatorOptions(editor)
    let options = {}
    let config = this.goconfig
    if (config) {
      options.env = config.environment(o)
    }
    if (!options.env) {
      options.env = process.env
    }
    return options
  },

  getRows (editor) {
    console.log('gounit: getrows called')
    let rows = []
    let range = editor.getSelectedBufferRange()

    for (let row = range.start.row; row <= range.end.row; row++) {
      let line = editor.lineTextForBufferRow(row)
      // this regexp matches go function defenition
      let match = line.match(/func(?:\s*\([^)]+\)\s*|\s+)([^)\s]+)\s*\(/)
      if (match !== undefined && match !== null && match.length > 1) {
        rows.push(row + 1)
      }
    }
    return rows 
  },

  generate () {
    let editor = atom.workspace.getActiveTextEditor()
    let filePath = editor.getPath()
    let config = this.goconfig

    if (this.toolCheckComplete != null) {
      return Promise.resolve().then(() => {
        let locatorOptions = this.getLocatorOptions(editor)
        return config.locator.findTool('gounit', locatorOptions).then((cmd) => {
          if (!cmd) {
            return false
          }
          // we cannot generate go test for go test
          if (filePath.endsWith('.go') && !filePath.endsWith('_test.go')) {
            let rows = this.getRows(editor)

            if (rows.length !== 0) {
              let args = ['gen', '-l']
              args.push(rows.join(','))
              args.push('-i')
              args.push(filePath)

              let executorOptions = this.getExecutorOptions(editor)
              return config.executor.exec(cmd, args, executorOptions).then((r) => {
                if (r.stderr && r.stderr.trim() !== '') {
                  console.log('gounit: (stderr) ' + r.stderr)
                } else {
                  atom.open({'pathsToOpen': [filePath.replace(/\.go$/, '_test.go')]})
                }
              })
            }
          }
        }).catch((e) => {
          if (e.handle) {
            e.handle()
          }
          console.log(e)
          return Promise.resolve()
        })
      })
    }
  }
}
