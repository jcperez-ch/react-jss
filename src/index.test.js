import expect from 'expect.js'
import jss, {create as createJss} from 'jss'
import React from 'react'
import {render, unmountComponentAtNode} from 'react-dom'
import deepForceUpdate from 'react-deep-force-update'
import injectSheet, {create as createInjectSheet, jss as reactJss} from './'

const node = document.createElement('div')

describe('react-jss', () => {
  afterEach(() => {
    unmountComponentAtNode(node)
  })

  describe('.create()', () => {
    let localInjectSheet
    let localJss

    beforeEach(() => {
      localJss = createJss()
      localInjectSheet = createInjectSheet(localJss)
    })

    it('should return a function', () => {
      expect(injectSheet).to.be.a(Function)
    })

    it('should use passed jss', () => {
      let passedJss
      const Component = ({sheet}) => {
        passedJss = sheet.options.jss
        return null
      }
      const WrappedComponent = localInjectSheet()(Component)
      render(<WrappedComponent />, node)
      expect(passedJss).to.be(localJss)
    })
  })

  describe('global jss instance', () => {
    it('should return a function', () => {
      expect(injectSheet).to.be.a(Function)
    })

    it('should be available', () => {
      expect(reactJss).to.be.an(jss.constructor)
    })
  })

  describe('.injectSheet()', () => {
    let WrappedComponent

    beforeEach(() => {
      const Component = () => null
      WrappedComponent = injectSheet({
        button: {color: 'red'}
      })(Component)
    })

    it('should attach and detach a sheet', () => {
      render(<WrappedComponent />, node)
      expect(document.querySelectorAll('style').length).to.be(1)
      unmountComponentAtNode(node)
      expect(document.querySelectorAll('style').length).to.be(0)
    })

    it('should reuse one sheet for 2 elements and detach sheet', () => {
      render(<WrappedComponent />, node)
      render(<WrappedComponent />, node)
      expect(document.querySelectorAll('style').length).to.be(1)
      unmountComponentAtNode(node)
      expect(document.querySelectorAll('style').length).to.be(0)
    })
  })

  describe('.injectSheet() with parent props composition', () => {
    let WrappedComponent

    beforeEach(() => {
      const Component = () => null
      WrappedComponent = injectSheet((parentProps = {buttonColor: 'red'}) => ({
        button: {color: parentProps.buttonColor}
      }))(Component)
    })
    it('should accept composed styles via parentProps', () => {
      render(<WrappedComponent />, node)
      expect(document.querySelectorAll('style').length).to.be(1)
    })

    it('should apply different styles based on parentProps', () => {
      class Parent extends React.Component {
        constructor(props, context) {
          super(props, context)
          this.state = {buttonColor: 'red'}
        }
        render() {
          this.child = <WrappedComponent {...this.state} />
          return this.child
        }
      }
      const container = render(<Parent />, node)
      expect(document.querySelectorAll('style')[0].innerHTML).to.contain('color: red')
      const sheet = document.querySelectorAll('style')[0]
      container.setState({buttonBorder: '1px solid black'})
      expect(document.querySelectorAll('style')[0]).to.eql(sheet)
      expect(document.querySelectorAll('style')[0].innerHTML).to.contain('color: red')
      container.setState({buttonColor: 'blue'})
      expect(document.querySelectorAll('style').length).to.be(1)
      expect(document.querySelectorAll('style')[0]).to.not.be(sheet)
      expect(document.querySelectorAll('style')[0].innerHTML).to.contain('color: blue')
      container.setState({buttonColor: 'green'})
      expect(document.querySelectorAll('style')[0].innerHTML).to.contain('color: green')
    })
  })

  describe('.injectSheet() without a component for global styles', () => {
    let Container

    beforeEach(() => {
      Container = injectSheet({
        button: {color: 'red'}
      })()
    })

    it('should attach and detach a sheet', () => {
      render(<Container />, node)
      expect(document.querySelectorAll('style').length).to.be(1)
      unmountComponentAtNode(node)
      expect(document.querySelectorAll('style').length).to.be(0)
    })

    it('should render children', () => {
      let isRendered = false
      const Component = () => {
        isRendered = true
        return null
      }
      render(<Container><Component /></Container>, node)
      unmountComponentAtNode(node)
      expect(isRendered).to.be(true)
    })
  })

  describe('.injectSheet() hot reloading', () => {
    function simulateHotReloading(container, TargetClass, SourceClass) {
      // Crude imitation of hot reloading that does the job
      Object.getOwnPropertyNames(SourceClass.prototype)
        .filter(key => typeof SourceClass.prototype[key] === 'function')
        .forEach((key) => {
          if (key !== 'render' && key !== 'constructor') {
            TargetClass.prototype[key] = SourceClass.prototype[key]
          }
        })

      deepForceUpdate(container)
    }

    let WrappedComponentA
    let WrappedComponentB
    let WrappedComponentC

    beforeEach(() => {
      unmountComponentAtNode(node)

      WrappedComponentA = injectSheet({
        button: {color: 'red'}
      })(() => null)

      WrappedComponentB = injectSheet({
        button: {color: 'green'}
      })(() => null)

      WrappedComponentC = injectSheet({
        button: {color: 'blue'}
      })(() => null)
    })

    it('should hot reload component and attach new sheets', () => {
      const container = render(<WrappedComponentA />, node)

      expect(document.querySelectorAll('style').length).to.be(1)
      expect(document.querySelectorAll('style')[0].innerHTML).to.contain('color: red')

      simulateHotReloading(container, WrappedComponentA, WrappedComponentB)

      expect(document.querySelectorAll('style').length).to.be(1)
      expect(document.querySelectorAll('style')[0].innerHTML).to.contain('color: green')

      simulateHotReloading(container, WrappedComponentA, WrappedComponentC)

      expect(document.querySelectorAll('style').length).to.be(1)
      expect(document.querySelectorAll('style')[0].innerHTML).to.contain('color: blue')
    })

    it('should properly detach sheets on hot reloaded component', () => {
      // eslint-disable-next-line
      class AppContainer extends React.Component {
        render() {
          return (
            <WrappedComponentA
              {...this.props}
              key={Math.random()} // Require children to unmount on every render
            />
          )
        }
      }

      const container = render(<AppContainer />, node)

      expect(document.querySelectorAll('style').length).to.be(1)
      expect(document.querySelectorAll('style')[0].innerHTML).to.contain('color: red')

      simulateHotReloading(container, WrappedComponentA, WrappedComponentB)

      expect(document.querySelectorAll('style').length).to.be(1)
      expect(document.querySelectorAll('style')[0].innerHTML).to.contain('color: green')

      simulateHotReloading(container, WrappedComponentA, WrappedComponentC)

      expect(document.querySelectorAll('style').length).to.be(1)
      expect(document.querySelectorAll('style')[0].innerHTML).to.contain('color: blue')
    })
  })
})
