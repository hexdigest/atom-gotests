'use babel'
/* eslint-env jasmine */

import fs from 'fs'
import path from 'path'
import temp from 'temp'

describe('gotests', () => {
  let mainModule = null
  let goconfig = null
  let goget = null
  let nl = '\n'

  beforeEach(() => {
    waitsForPromise(() => {
      return atom.packages.activatePackage('language-go')
    })
    runs(() => {
      atom.packages.triggerDeferredActivationHooks()
      let pack = atom.packages.loadPackage('go-plus')
      pack.activateNow()
      atom.packages.triggerActivationHook('core:loaded-shell-environment')
      atom.packages.triggerActivationHook('language-go:grammar-used')
      mainModule = pack.mainModule
      goconfig = mainModule.provideGoConfig()
      goget = mainModule.provideGoGet()
    })

    waitsFor(() => { return mainModule && mainModule.loaded })

    runs(() => {
      let pack = atom.packages.loadPackage('gotests')
      pack.activateNow()
      mainModule = pack.mainModule
      mainModule.consumeGoget(goget)
      mainModule.consumeGoconfig(goconfig)
    })

    waitsFor(() => {
      return mainModule && mainModule.goconfig && mainModule.goget
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
    let testFilePath
    let editor
    let saveSubscription
    let functions
    let directory
    beforeEach(() => {
      var tempName = temp.path();
      directory = tempName.replace('.', '')
      fs.mkdirSync(directory)
      atom.project.setPaths([directory])
      filePath = path.join(directory, 'main.go')
      testFilePath = path.join(directory, 'main_test.go')
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
      fs.unlinkSync(filePath)
      try {
        fs.unlinkSync(testFilePath)
      } catch (e) {}
      fs.rmdirSync(directory)
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
          fs.accessSync(testFilePath, fs.F_OK)
          exists = true
        } catch (e) {
          exists = false
        }
        return exists
      })

      runs(() => {
        let content = fs.readFileSync(testFilePath, 'UTF-8')
        expect(content).toMatch(/func Test/)
      })
    })
  })
})
