const assert = require('assert')
const ethUtil = require('ethereumjs-util')
const EthTx = require('ethereumjs-tx')
const ObservableStore = require('obs-store')
const clone = require('clone')
const sinon = require('sinon')
const TransactionController = require('../../app/scripts/controllers/transactions')
const TxGasUtils = require('../../app/scripts/lib/tx-gas-utils')
const txStateHistoryHelper = require('../../app/scripts/lib/tx-state-history-helper')
const TxStateManager = require('../../app/scripts/lib/tx-state-manager')
const { createStubedProvider } = require('../stub/provider')

const noop = () => true
const currentNetworkId = 42
const otherNetworkId = 36
const privKey = new Buffer('8718b9618a37d1fc78c436511fc6df3c8258d3250635bba617f33003270ec03e', 'hex')


describe('Transaction Controller', function () {
  let txController, engine, provider, providerResultStub

  beforeEach(function () {
    providerResultStub = {}
    provider = createStubedProvider(providerResultStub)

    txController = new TransactionController({
      provider,
      networkStore: new ObservableStore(currentNetworkId),
      txHistoryLimit: 10,
      blockTracker: { getCurrentBlock: noop, on: noop, once: noop },
      ethStore: { getState: noop },
      signTransaction: (ethTx) => new Promise((resolve) => {
        ethTx.sign(privKey)
        resolve()
      }),
    })
    txController.nonceTracker.getNonceLock = () => Promise.resolve({ nextNonce: 0, releaseLock: noop })
    txController.txProviderUtils = new TxGasUtils(txController.provider)  
  })

  describe('#getState', function () {
    it('should return a state object with the right keys and datat types', function () {
      const exposedState = txController.getState()
      assert('unapprovedTxs' in exposedState, 'state should have the key unapprovedTxs')
      assert('selectedAddressTxList' in exposedState, 'state should have the key selectedAddressTxList')
      assert(typeof exposedState.unapprovedTxs === 'object', 'should be an object')
      assert(Array.isArray(exposedState.selectedAddressTxList), 'should be an array')
    })
  })

  describe('#getUnapprovedTxCount', function () {
    it('should return the number of unapproved txs', function () {
      txController.txStateManager._saveTxList([
        { id: 1, status: 'unapproved', metamaskNetworkId: currentNetworkId, txParams: {} },
        { id: 2, status: 'unapproved', metamaskNetworkId: currentNetworkId, txParams: {} },
        { id: 3, status: 'unapproved', metamaskNetworkId: currentNetworkId, txParams: {} },
      ])
      const unapprovedTxCount = txController.getUnapprovedTxCount()
      assert.equal(unapprovedTxCount, 3, 'should be 3')
    })
  })

  describe('#getPendingTxCount', function () {
    it('should return the number of pending txs', function () {
      txController.txStateManager._saveTxList([
        { id: 1, status: 'submitted', metamaskNetworkId: currentNetworkId, txParams: {} },
        { id: 2, status: 'submitted', metamaskNetworkId: currentNetworkId, txParams: {} },
        { id: 3, status: 'submitted', metamaskNetworkId: currentNetworkId, txParams: {} },
      ])
      const pendingTxCount = txController.getPendingTxCount()
      assert.equal(pendingTxCount, 3, 'should be 3')
    })
  })

  describe('#getConfirmedTransactions', function () {
    let address
    beforeEach(function () {
      address = '0xc684832530fcbddae4b4230a47e991ddcec2831d'
      const txParams = {
        'from': address,
        'to': '0xc684832530fcbddae4b4230a47e991ddcec2831d',
      }
      txController.txStateManager._saveTxList([
        {id: 1, status: 'confirmed', metamaskNetworkId: currentNetworkId, txParams},
        {id: 2, status: 'confirmed', metamaskNetworkId: currentNetworkId, txParams},
        {id: 3, status: 'confirmed', metamaskNetworkId: currentNetworkId, txParams},
      ])
    })
    it('should return the number of confirmed txs', function () {
      assert.equal(txController.nonceTracker.getConfirmedTransactions(address).length, 3)
    })
  })


  describe('#newUnapprovedTransaction', function () {
    let stub, txMeta, txParams
    beforeEach(function () {
      txParams = {
        'from': '0xc684832530fcbddae4b4230a47e991ddcec2831d',
        'to': '0xc684832530fcbddae4b4230a47e991ddcec2831d',
      },
      txMeta = {
        status: 'unapproved',
        id: 1,
        metamaskNetworkId: currentNetworkId,
        txParams,
        history: [],
      }
      txController.txStateManager._saveTxList([txMeta])
      stub = sinon.stub(txController, 'addUnapprovedTransaction').returns(Promise.resolve(txController.txStateManager.addTx(txMeta)))
    })

    afterEach(function () {
      txController.txStateManager._saveTxList([])
      stub.restore()
    })

    it('should emit newUnaprovedTx event and pass txMeta as the first argument', function (done) {
      txController.once('newUnaprovedTx', (txMetaFromEmit) => {
        assert(txMetaFromEmit, 'txMeta is falsey')
        assert.equal(txMetaFromEmit.id, 1, 'the right txMeta was passed')
        done()
      })
      txController.newUnapprovedTransaction(txParams)
      .catch(done)
    })

    it('should resolve when finished and status is submitted and resolve with the hash', function (done) {
      txController.once('newUnaprovedTx', (txMetaFromEmit) => {
        setTimeout(() => {
          txController.setTxHash(txMetaFromEmit.id, '0x0')
          txController.txStateManager.setTxStatusSubmitted(txMetaFromEmit.id)
        }, 10)
      })

      txController.newUnapprovedTransaction(txParams)
      .then((hash) => {
        assert(hash, 'newUnapprovedTransaction needs to return the hash')
        done()
      })
      .catch(done)
    })

    it('should reject when finished and status is rejected', function (done) {
      txController.once('newUnaprovedTx', (txMetaFromEmit) => {
        setTimeout(() => {
          txController.txStateManager.setTxStatusRejected(txMetaFromEmit.id)
        }, 10)
      })

      txController.newUnapprovedTransaction(txParams)
      .catch((err) => {
        if (err.message === 'MetaMask Tx Signature: User denied transaction signature.') done()
        else done(err)
      })
    })
  })

  describe('#addUnapprovedTransaction', function () {
    it('should add an unapproved transaction and return a valid txMeta', function (done) {
      const addTxDefaultsStub = sinon.stub(txController, 'addTxDefaults').callsFake(() => Promise.resolve())
      txController.addUnapprovedTransaction({})
      .then((txMeta) => {
        assert(('id' in txMeta), 'should have a id')
        assert(('time' in txMeta), 'should have a time stamp')
        assert(('metamaskNetworkId' in txMeta), 'should have a metamaskNetworkId')
        assert(('txParams' in txMeta), 'should have a txParams')
        assert(('history' in txMeta), 'should have a history')

        const memTxMeta = txController.txStateManager.getTx(txMeta.id)
        assert.deepEqual(txMeta, memTxMeta, `txMeta should be stored in txController after adding it\n  expected: ${txMeta} \n  got: ${memTxMeta}`)
        addTxDefaultsStub.restore()
        done()
      }).catch(done)
    })
  })

  describe('#addTxDefaults', function () {
    it('should add the tx defaults if their are none', function (done) {
      const txMeta = {
        'txParams': {
          'from': '0xc684832530fcbddae4b4230a47e991ddcec2831d',
          'to': '0xc684832530fcbddae4b4230a47e991ddcec2831d',
        },
      }
        providerResultStub.eth_gasPrice = '4a817c800'
        providerResultStub.eth_getBlockByNumber = { gasLimit: '47b784' }
        providerResultStub.eth_estimateGas = '5209'
      txController.addTxDefaults(txMeta)
      .then((txMetaWithDefaults) => {
        assert(txMetaWithDefaults.txParams.value, '0x0', 'should have added 0x0 as the value')
        assert(txMetaWithDefaults.txParams.gasPrice, 'should have added the gas price')
        assert(txMetaWithDefaults.txParams.gas, 'should have added the gas field')
        done()
      })
      .catch(done)
    })
  })

  xdescribe('#updateAndApprovedTransaction', function () {
    it('should update txMeta and approve status for Tx', async function () {
      txController.txStateManager.addTx({ id: 0, status: 'unapproved', txParams: { from: '0x1678a085c290ebd122dc42cba69373b5953b831d', nonce: '0x1', value: '0xfffff' }, metamaskNetworkId: currentNetworkId })
      const txMeta = txController.txStateManager.getTx(0)
      txMeta.value = '0xffffe'
      provider.eth_sendRawTransaction = 0x7f9fade1c0d57a7af66ab4ead79fade1c0d57a7af66ab4ead7c2c2eb7b11a91385
      await txController.updateAndApproveTransaction(txMeta)
    })
  })

  describe('#validateTxParams', function () {
    it('does not throw for positive values', function (done) {
      var sample = {
        value: '0x01',
      }
      txController.txProviderUtils.validateTxParams(sample).then(() => {
        done()
      }).catch(done)
    })

    it('returns error for negative values', function (done) {
      var sample = {
        value: '-0x01',
      }
      txController.txProviderUtils.validateTxParams(sample)
      .then(() => done('expected to thrown on negativity values but didn\'t'))
      .catch((err) => {
        assert.ok(err, 'error')
        done()
      })
    })
  })

  describe('#addTx', function () {
    it('should emit updates', function (done) {
      const txMeta = {
        id: '1',
        status: 'unapproved',
        metamaskNetworkId: currentNetworkId,
        txParams: {},
      }

      const eventNames = ['updateBadge', '1:unapproved']
      const listeners = []
      eventNames.forEach((eventName) => {
        listeners.push(new Promise((resolve) => {
          txController.once(eventName, (arg) => {
            resolve(arg)
          })
        }))
      })
      Promise.all(listeners)
      .then((returnValues) => {
        assert.deepEqual(returnValues.pop(), txMeta, 'last event 1:unapproved should return txMeta')
        done()
      })
      .catch(done)
      txController.addTx(txMeta)
    })
  })

  describe('#approveTransaction', function () {
    let txMeta, originalValue

    beforeEach(function () {
      originalValue = '0x01'
      txMeta = {
        id: '1',
        status: 'unapproved',
        metamaskNetworkId: currentNetworkId,
        txParams: {
          nonce: originalValue,
          gas: originalValue,
          gasPrice: originalValue,
        },
      }
    })


    it('does not overwrite set values', function (done) {
      this.timeout(15000)
      const wrongValue = '0x05'

      txController.addTx(txMeta)
      providerResultStub.eth_gasPrice = wrongValue
      providerResultStub.eth_estimateGas = '0x5209'

      const signStub = sinon.stub(txController, 'signTransaction').callsFake(() => Promise.resolve())

      const pubStub = sinon.stub(txController, 'publishTransaction').callsFake(() => {
        txController.setTxHash('1', originalValue)
        txController.txStateManager.setTxStatusSubmitted('1')
      })

      txController.approveTransaction(txMeta.id).then(() => {
        const result = txController.txStateManager.getTx(txMeta.id)
        const params = result.txParams

        assert.equal(params.gas, originalValue, 'gas unmodified')
        assert.equal(params.gasPrice, originalValue, 'gas price unmodified')
        assert.equal(result.hash, originalValue, `hash was set \n got: ${result.hash} \n expected: ${originalValue}`)
        signStub.restore()
        pubStub.restore()
        done()
      }).catch(done)
    })
  })

  describe('#sign replay-protected tx', function () {
    it('prepares a tx with the chainId set', function (done) {
      txController.addTx({ id: '1', status: 'unapproved', metamaskNetworkId: currentNetworkId, txParams: {} }, noop)
      txController.signTransaction('1').then((rawTx) => {
        const ethTx = new EthTx(ethUtil.toBuffer(rawTx))
        assert.equal(ethTx.getChainId(), currentNetworkId)
        done()
      }).catch(done)
    })
  })

  describe('#getChainId', function () {
    it('returns 0 when the chainId is NaN', async function () {
      txController.networkStore = new ObservableStore('hello')
      assert.equal(txController.getChainId(), 0)
    })
  })

  describe('#publishTransaction', async function () {
    beforeEach(function () {
      const txMeta = [
        { id: 0, status: 'unapproved', txParams: { from: '0x1678a085c290ebd122dc42cba69373b5953b831d', nonce: '0x1', value: '0xfffff' }, rawTx: 'f8498080808080801ca00255b75b550cf112e18fd699f27d043d85348c29d7e8fd234799db890f7c272da0238121aed40c3141e63aae5335aaa3c9711d4907f28071f81f8d055b9f8435e0', metamaskNetworkId: currentNetworkId },
      ]
      txController.txStateManager.addTx(txMeta)
    })

    it('should update rawTx of a transaction', async function () {
      txController.publishTransaction(0, 'f84c01808080830fffff801ca0e23554ce6f82186402dcdcfff377793fdfa8a872a5670c0ffc002c9cd2f6827aa02a83dfce20aef4064a55320bda47394043af3cbfa63c4e029c54ba6281dcc70e')
    })
  })

  describe('#cancelTransaction', function () {
    beforeEach(function () {
      const txMetas = [
        { id: 0, status: 'unapproved', txParams: { }, metamaskNetworkId: currentNetworkId },
        { id: 1, status: 'rejected', txParams: { }, metamaskNetworkId: currentNetworkId },
        { id: 2, status: 'approved', txParams: { }, metamaskNetworkId: currentNetworkId },
        { id: 3, status: 'signed', txParams: { }, metamaskNetworkId: currentNetworkId },
        { id: 4, status: 'submitted', txParams: { }, metamaskNetworkId: currentNetworkId },
        { id: 5, status: 'confirmed', txParams: { }, metamaskNetworkId: currentNetworkId },
        { id: 6, status: 'failed', txParams: { }, metamaskNetworkId: currentNetworkId },
      ]
      txMetas.forEach((txMeta) => txController.txStateManager.addTx(txMeta))
    })

    it('should set the transaction to rejected from unapproved', async function () {
      await txController.cancelTransaction(0)
      assert(txController.txStateManager.getTx(0).status, 'rejected')
    })

    it('should set the transaction to rejected from rejected', async function () {
      await txController.cancelTransaction(1)
      assert(txController.txStateManager.getTx(1).status, 'rejected')
    })

    it('should set the transaction to rejected from approved', async function () {
      await txController.cancelTransaction(2)
      assert(txController.txStateManager.getTx(2).status, 'rejected')
    })

    it('should set the transaction to rejected from signed', async function () {
      await txController.cancelTransaction(3)
      assert(txController.txStateManager.getTx(3).status, 'rejected')
    })

    it('should set the transaction to rejected from submitted', async function () {
      await txController.cancelTransaction(4)
      assert(txController.txStateManager.getTx(4).status, 'rejected')
    })

    it('should set the transaction to rejected from confirmed', async function () {
      await txController.cancelTransaction(5)
      assert(txController.txStateManager.getTx(5).status, 'rejected')
    })

    it('should set the transaction to rejected from failed', async function () {
      await txController.cancelTransaction(6)
      assert(txController.txStateManager.getTx(6).status, 'rejected')
    })

  })

  describe('#publishTransaction', function () {
    let replaceRawTx, rawTx, hash, txMeta
    beforeEach(function () {
      rawTx = 'f86c808504a817c800827b0d940c62bb85faa3311a998d3aba8098c1235c564966880de0b6b3a7640000802aa08ff665feb887a25d4099e40e11f0fef93ee9608f404bd3f853dd9e84ed3317a6a02ec9d3d1d6e176d4d2593dd760e74ccac753e6a0ea0d00cc9789d0d7ff1f471d'
      replaceRawTx = 'f84c01808080830fffff801ca0e23554ce6f82186402dcdcfff377793fdfa8a872a5670c0ffc002c9cd2f6827aa02a83dfce20aef4064a55320bda47394043af3cbfa63c4e029c54ba6281dcc70e'
      txMeta = {
        id: 1,
        status: 'approved',
        txParams: {},
        rawTx,
        hash,
        metamaskNetworkId: currentNetworkId,
      }
      providerResultStub.eth_sendRawTransaction = '0x2a5523c6fa98b47b7d9b6c8320179785150b42a16bcff36b398c5062b65657e8'
    })
    it('should publish a tx, updates the rawTx when provided a one', async function () {
      txController.txStateManager.addTx(txMeta)
      await txController.publishTransaction(txMeta.id, replaceRawTx)
      txController.setTxHash(1, '0x2a5523c6fa98b47b7d9b6c8320179785150b42a16bcff36b398c5062b65657e8')
      assert.equal(txController.txStateManager.getTx(1).rawTx, replaceRawTx)
      assert.notEqual(txController.txStateManager.getTx(1).rawTx, rawTx)
    })
  })

  describe('#getBalance', function () {
    it('gets balance', function () {
      sinon.stub(txController.ethStore, 'getState').callsFake(() => {
        return {
          accounts: {
            '0x1678a085c290ebd122dc42cba69373b5953b831d': {
              address: '0x1678a085c290ebd122dc42cba69373b5953b831d',
              balance: '0x00000000000000056bc75e2d63100000',
              code: '0x',
              nonce: '0x0',
            },
            '0xc684832530fcbddae4b4230a47e991ddcec2831d': {
              address: '0xc684832530fcbddae4b4230a47e991ddcec2831d',
              balance: '0x0',
              code: '0x',
              nonce: '0x0',
            },
          },
        }
      })
      assert.equal(txController.pendingTxTracker.getBalance('0x1678a085c290ebd122dc42cba69373b5953b831d'), '0x00000000000000056bc75e2d63100000')
      assert.equal(txController.pendingTxTracker.getBalance('0xc684832530fcbddae4b4230a47e991ddcec2831d'), '0x0')
    })
  })

  describe('#getPendingTransactions', function () {
    beforeEach(function () {
      txController.txStateManager._saveTxList([
        { id: 1, status: 'unapproved', metamaskNetworkId: currentNetworkId, txParams: {} },
        { id: 2, status: 'rejected', metamaskNetworkId: currentNetworkId, txParams: {} },
        { id: 3, status: 'approved', metamaskNetworkId: currentNetworkId, txParams: {} },        
        { id: 4, status: 'signed', metamaskNetworkId: currentNetworkId, txParams: {} },
        { id: 5, status: 'submitted', metamaskNetworkId: currentNetworkId, txParams: {} },
        { id: 6, status: 'confimed', metamaskNetworkId: currentNetworkId, txParams: {} },
        { id: 7, status: 'failed', metamaskNetworkId: currentNetworkId, txParams: {} },
      ])
    })
    it('should show only submitted transactions as pending transasction', function () {
      assert(txController.pendingTxTracker.getPendingTransactions().length, 1)
      assert(txController.pendingTxTracker.getPendingTransactions()[0].status, 'submitted')
    })
  })

})
