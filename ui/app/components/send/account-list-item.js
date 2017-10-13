const Component = require('react').Component
const h = require('react-hyperscript')
const inherits = require('util').inherits
const connect = require('react-redux').connect
const Identicon = require('../identicon')
const CurrencyDisplay = require('./currency-display')
const { conversionRateSelector } = require('../../selectors')

inherits(AccountListItem, Component)
function AccountListItem () {
  Component.call(this)
}

function mapStateToProps(state) {
  return {
    conversionRate: conversionRateSelector(state)
  }
}

module.exports = connect(mapStateToProps)(AccountListItem)

AccountListItem.prototype.render = function () {
  const {
    account, 
    handleClick, 
    icon = null,
    conversionRate,
  } = this.props

  const { name, address, balance } = account

  return h('div.account-list-item', {
    onClick: () => handleClick({ name, address, balance }),
  }, [

    h('div.account-list-item__top-row', {}, [

      h(
        Identicon,
        {
          address,
          diameter: 18,
          className: 'account-list-item__identicon',
        },
      ),

      h('div.account-list-item__account-name', {}, name),

      icon && h('div.account-list-item__icon', [icon]),

    ]),

    h(CurrencyDisplay, {
      primaryCurrency: 'ETH',
      convertedCurrency: 'USD',
      value: balance,
      conversionRate,
      convertedPrefix: '$',
      readOnly: true,
      className: 'account-list-item__account-balances',
      primaryBalanceClassName: 'account-list-item__account-primary-balance',
      convertedBalanceClassName: 'account-list-item__account-secondary-balance',
    }, name),

  ])
}