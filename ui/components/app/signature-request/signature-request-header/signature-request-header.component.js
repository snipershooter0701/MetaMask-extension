import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import AccountListItem from '../../account-list-item';
import NetworkDisplay from '../../network-display';

export default class SignatureRequestHeader extends PureComponent {
  static propTypes = {
    fromAccount: PropTypes.object,
  };

  render() {
    const { fromAccount } = this.props;

    return (
      <div className="signature-request-header">
        <div className="signature-request-header--account">
          {fromAccount ? (
            <AccountListItem
              account={fromAccount}
              ///: BEGIN:ONLY_INCLUDE_IN(build-mmi)
              hideDefaultMismatchWarning
              ///: END:ONLY_INCLUDE_IN
            />
          ) : null}
        </div>
        <div className="signature-request-header--network">
          <NetworkDisplay />
        </div>
      </div>
    );
  }
}
