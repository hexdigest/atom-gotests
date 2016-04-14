'use babel'
/* eslint-env jasmine */

import fs from 'fs'
import path from 'path'
import temp from 'temp'

describe('gotests', () => {
  let mainModule = null
  let nl = '\n'

  beforeEach(() => {
    waitsForPromise(() => {
      return atom.packages.activatePackage('go-config').then(() => {
        return atom.packages.activatePackage('language-go').then(() => {
          return atom.packages.activatePackage('go-get')
        })
      }).then(() => {
        return atom.packages.activatePackage('gotests')
      }).then((pack) => {
        mainModule = pack.mainModule
      })
    })

    waitsFor(() => {
      return mainModule.goconfig && mainModule.goget
    })
  })

  describe('when the gotests package is activated', () => {
    it('activates successfully', () => {
      expect(mainModule).toBeDefined()
      expect(mainModule).toBeTruthy()
      expect(mainModule.consumeGoget).toBeDefined()
      expect(mainModule.consumeGoconfig).toBeDefined()
      expect(mainModule.goconfig).toBeTruthy()
      expect(mainModule.goget).toBeTruthy()
    })
  })

  describe('when we are generating tests for go file', () => {
    let filePath
    let editor
    let saveSubscription
    let functions
    let directory
    beforeEach(() => {
      directory = fs.realpathSync(temp.mkdirSync())
      atom.project.setPaths([directory])
      filePath = path.join(directory, 'main.go')
      fs.writeFileSync(filePath, '')
      waitsForPromise(() => {
        return atom.workspace.open(filePath).then((e) => {
          editor = e
          saveSubscription = e.onDidSave(() => {
            functions = mainModule.getFunctions(e)
          })
        })
      })
    })

    afterEach(() => {
      if (saveSubscription) {
        saveSubscription.dispose()
      }
      functions = undefined
    })

    it('finds correct go functions', () => {
      let text = 'package main' + nl + nl + 'func main()  {' + nl + '}' + nl
      text += 'func ReadConfigFile(filePath string) ([]string, error) {' + nl + '}'
      text += 'func  Strangely_named-Function  ( filePath string ) ( []string,error )  {' + nl + '}'

      runs(() => {
        let buffer = editor.getBuffer()
        buffer.setText(text)
        editor.selectAll()
        buffer.save()
      })

      waitsFor(() => {
        return functions
      })

      runs(() => {
        expect(functions).toBeDefined()
        expect(functions).toContain('main')
        expect(functions).toContain('ReadConfigFile')
        expect(functions).toContain('Strangely_named-Function')
      })
    })

    it('generates test file nearby', () => {
      let text = 'package main' + nl + nl + 'func main()  {' + nl + '}' + nl

      runs(() => {
        let buffer = editor.getBuffer()
        buffer.setText(text)
        buffer.save()
        editor.selectAll()
        let target = atom.views.getView(editor)
        atom.commands.dispatch(target, 'gotests:generate')
      })
      waitsFor(() => {
        let exists
        try {
          let filePath = path.join(directory, 'main_test.go')
          fs.accessSync(filePath, fs.F_OK)
          exists = true
        } catch (e) {
          exists = false
        }
        return exists
      })

      runs(() => {
        let filePath = path.join(directory, 'main_test.go')
        let content = fs.readFileSync(filePath, 'UTF-8')
        expect(content).toMatch(/TestMain/)
      })
    })
  })
})
