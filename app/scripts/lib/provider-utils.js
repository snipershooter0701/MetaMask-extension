const async = require('async')
const EthQuery = require('eth-query')
const ethUtil = require('ethereumjs-util')
const BN = ethUtil.BN
const ethBinToOps = require('eth-bin-to-ops')

module.exports = class txProviderUtils {
  constructor (provider) {
    this.provider = provider
    this.query = new EthQuery(provider)
  }
  analyzeGasUsage (txData, cb) {
    var self = this
    this.query.getBlockByNumber('latest', true, (err, block) => {
      if (err) return cb(err)
      async.waterfall([
        self.estimateTxGas.bind(self, txData, block.gasLimit),
        self.checkForTxGasError.bind(self, txData),
        self.setTxGas.bind(self, txData, block.gasLimit),
      ], cb)
    })
  }

    // perform static analyis on the target contract code
  analyzeForDelegateCall (txParams, cb) {
    if (txParams.to) {
      this.query.getCode(txParams.to, function (err, result) {
        if (err) return cb(err)

        var code = ethUtil.toBuffer(result)
        if (code !== '0x') {
          var ops = ethBinToOps(code)
          var containsDelegateCall = ops.some((op) => op.name === 'DELEGATECALL')
          cb(containsDelegateCall)
        } else {
          cb()
        }
      })
    } else {
      cb()
    }
  }

  estimateTxGas (txData, blockGasLimitHex, cb) {
    const txParams = txData.txParams
    // check if gasLimit is already specified
    txData.gasLimitSpecified = Boolean(txParams.gas)
    // if not, fallback to block gasLimit
    if (!txData.gasLimitSpecified) {
      txParams.gas = blockGasLimitHex
    }
    // run tx, see if it will OOG
    this.query.estimateGas(txParams, cb)
  }

  checkForTxGasError (txData, estimatedGasHex, cb) {
    txData.estimatedGas = estimatedGasHex
    // all gas used - must be an error
    if (estimatedGasHex === txData.txParams.gas) {
      txData.simulationFails = true
    }
    cb()
  }

  handleFork (block) {

  }

  setTxGas (txData, blockGasLimitHex, cb) {
    const txParams = txData.txParams
    // if OOG, nothing more to do
    if (txData.simulationFails) {
      cb()
      return
    }
    // if gasLimit was specified and doesnt OOG,
    // use original specified amount
    if (txData.gasLimitSpecified) {
      txData.estimatedGas = txParams.gas
      cb()
      return
    }
    // if gasLimit not originally specified,
    // try adding an additional gas buffer to our estimation for safety
    const estimatedGasBn = new BN(ethUtil.stripHexPrefix(txData.estimatedGas), 16)
    const blockGasLimitBn = new BN(ethUtil.stripHexPrefix(blockGasLimitHex), 16)
    const estimationWithBuffer = new BN(this.addGasBuffer(estimatedGasBn), 16)
    // added gas buffer is too high
    if (estimationWithBuffer.gt(blockGasLimitBn)) {
      txParams.gas = txData.estimatedGas
    // added gas buffer is safe
    } else {
      const gasWithBufferHex = ethUtil.intToHex(estimationWithBuffer)
      txParams.gas = gasWithBufferHex
    }
    cb()
    return
  }

  addGasBuffer (gas) {
    const gasBuffer = new BN('100000', 10)
    const bnGas = new BN(ethUtil.stripHexPrefix(gas), 16)
    const correct = bnGas.add(gasBuffer)
    return ethUtil.addHexPrefix(correct.toString(16))
  }
}
