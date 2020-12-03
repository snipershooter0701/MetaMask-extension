import assert from 'assert'
import React from 'react'
import { shallow } from 'enzyme'
import sinon from 'sinon'
import SendHeader from '../send-header.component'
import PageContainerHeader from '../../../../components/ui/page-container/page-container-header'

describe('SendHeader Component', function () {
  let wrapper

  const propsMethodSpies = {
    clearSend: sinon.spy(),
  }
  const historySpies = {
    push: sinon.spy(),
  }

  before(function () {
    sinon.spy(SendHeader.prototype, 'onClose')
  })

  beforeEach(function () {
    wrapper = shallow(
      <SendHeader
        clearSend={propsMethodSpies.clearSend}
        history={historySpies}
        mostRecentOverviewPage="mostRecentOverviewPage"
        titleKey="mockTitleKey"
      />,
      { context: { t: (str1, str2) => (str2 ? str1 + str2 : str1) } },
    )
  })

  afterEach(function () {
    propsMethodSpies.clearSend.resetHistory()
    historySpies.push.resetHistory()
    SendHeader.prototype.onClose.resetHistory()
  })

  after(function () {
    sinon.restore()
  })

  describe('onClose', function () {
    it('should call clearSend', function () {
      assert.strictEqual(propsMethodSpies.clearSend.callCount, 0)
      wrapper.instance().onClose()
      assert.strictEqual(propsMethodSpies.clearSend.callCount, 1)
    })

    it('should call history.push', function () {
      assert.strictEqual(historySpies.push.callCount, 0)
      wrapper.instance().onClose()
      assert.strictEqual(historySpies.push.callCount, 1)
      assert.strictEqual(
        historySpies.push.getCall(0).args[0],
        'mostRecentOverviewPage',
      )
    })
  })

  describe('render', function () {
    it('should render a PageContainerHeader component', function () {
      assert.strictEqual(wrapper.find(PageContainerHeader).length, 1)
    })

    it('should pass the correct props to PageContainerHeader', function () {
      const { onClose, title } = wrapper.find(PageContainerHeader).props()
      assert.strictEqual(title, 'mockTitleKey')
      assert.strictEqual(SendHeader.prototype.onClose.callCount, 0)
      onClose()
      assert.strictEqual(SendHeader.prototype.onClose.callCount, 1)
    })
  })
})
