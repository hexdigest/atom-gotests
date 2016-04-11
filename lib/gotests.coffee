{BufferedProcess, CompositeDisposable} = require 'atom'

module.exports = Gotests =
  subscriptions: null
  config:
    executablePath:
      type: 'string'
      title: 'gotests executable path'
      default: 'gotests'

  activate: (state) ->
    @subscriptions = new CompositeDisposable
    @subscriptions.add atom.commands.add 'atom-workspace',
      'gotests:generate': => @generate()
    @subscriptions.add atom.config.observe 'gotests.executablePath',
      (executablePath) =>
        @executablePath = executablePath


  deactivate: ->
    @subscriptions.dispose()

  generate: ->
    editor = atom.workspace.getActiveTextEditor()
    filePath = editor.getPath()
    projectPath = atom.project.getPaths()
    # we cannot generate go test for go test
    if filePath.endsWith(".go") && !filePath.endsWith("_test.go")
      range = editor.getSelectedBufferRange()

      functions = []

      for row in [range.start.row .. range.end.row]
        line = editor.lineTextForBufferRow(row)
        # this regexp matches go function defenition
        match = line.match(/func\s+(.+)\s?\(/)
        if match
          functions.push match[1]

      if functions
        args = ["-w"]
        args.push '-only=(?i)^(' + functions.join('|') + ')$'
        args.push filePath

        output = ""
        process = new BufferedProcess
          command: @executablePath
          args: args
          options:
            cwd: projectPath[0]
          stdout: (data) ->
            output += data
          exit: (code) ->
            if code != 0
              atom.notifications.addError "Failed to generate Go tests",
                detail: "Output was: '#{output}'"
                dismissable: true
        process.onWillThrowError ({error,handle}) ->
          atom.notifications.addError "Failed to run #{@executablePath}",
            detail: "#{error.message}"
            dismissable: true
          handle()
