'use babel'
/* eslint-env jasmine */

import fs from 'fs'
import path from 'path'
import temp from 'temp'
import {lifecycle} from './spec-helpers'

function setTextAndSave (editor, text) {
  const buffer = editor.getBuffer()
  buffer.setText(text)
  editor.selectAll()
  return Promise.resolve(buffer.save())
}

describe('gotests', () => {
  let mainModule = null
  let goconfig = null
  let goget = null
  let nl = '\n'

  beforeEach(() => {
    lifecycle.setup()
    waitsForPromise(() => {
      return lifecycle.activatePackage()
    })
    runs(() => {
      goconfig = lifecycle.mainModule.provideGoConfig()
      goget = lifecycle.mainModule.provideGoGet()
    })
    waitsForPromise(() => {
      return atom.packages.activatePackage('gotests').then((pack) => {
        mainModule = pack.mainModule
      })
    })

    runs(() => {
      mainModule.consumeGoget(goget)
      mainModule.consumeGoconfig(goconfig)
    })

    waitsFor(() => {
      return mainModule && mainModule.goconfig && mainModule.goget
    })
  })

  afterEach(() => {
    lifecycle.teardown()
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
      var tempName = temp.path()
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
      text += 'func(t *T) FuncWithReciever(a int) int {' + nl + '}'

      waitsForPromise(() => {
        return setTextAndSave(editor, text)
      })

      waitsFor(() => {
        return functions
      })

      runs(() => {
        expect(functions).toBeDefined()
        expect(functions).toContain('main')
        expect(functions).toContain('ReadConfigFile')
        expect(functions).toContain('Strangely_named-Function')
        expect(functions).toContain('FuncWithReciever')
      })
    })

    it('generates test file nearby', () => {
      let text = 'package main' + nl + nl + 'func main()  {' + nl + '}' + nl

      waitsForPromise(() => {
        return setTextAndSave(editor, text)
      })

      runs(() => {
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
