import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import SenderToRecipient from '../../ui/sender-to-recipient';
import { PageContainerFooter } from '../../ui/page-container';
import EditGasPopover from '../edit-gas-popover';
import { EDIT_GAS_MODES } from '../../../../shared/constants/gas';
import { getAddressBookEntry } from '../../../selectors';
import * as actions from '../../../store/actions';
import Dialog from '../../ui/dialog';
import {
  ConfirmPageContainerHeader,
  ConfirmPageContainerContent,
  ConfirmPageContainerNavigation,
} from '.';

class ConfirmPageContainer extends Component {
  static contextTypes = {
    t: PropTypes.func,
  };

  static propTypes = {
    // Header
    action: PropTypes.string,
    hideSubtitle: PropTypes.bool,
    onEdit: PropTypes.func,
    showEdit: PropTypes.bool,
    subtitleComponent: PropTypes.node,
    title: PropTypes.string,
    titleComponent: PropTypes.node,
    hideSenderToRecipient: PropTypes.bool,
    showAccountInHeader: PropTypes.bool,
    // Sender to Recipient
    fromAddress: PropTypes.string,
    fromName: PropTypes.string,
    toAddress: PropTypes.string,
    toName: PropTypes.string,
    toEns: PropTypes.string,
    toNickname: PropTypes.string,
    // Content
    contentComponent: PropTypes.node,
    errorKey: PropTypes.string,
    errorMessage: PropTypes.string,
    dataComponent: PropTypes.node,
    detailsComponent: PropTypes.node,
    identiconAddress: PropTypes.string,
    nonce: PropTypes.string,
    assetImage: PropTypes.string,
    warning: PropTypes.string,
    unapprovedTxCount: PropTypes.number,
    origin: PropTypes.string.isRequired,
    ethGasPriceWarning: PropTypes.string,
    // Navigation
    totalTx: PropTypes.number,
    positionOfCurrentTx: PropTypes.number,
    nextTxId: PropTypes.string,
    prevTxId: PropTypes.string,
    showNavigation: PropTypes.bool,
    onNextTx: PropTypes.func,
    firstTx: PropTypes.string,
    lastTx: PropTypes.string,
    ofText: PropTypes.string,
    requestsWaitingText: PropTypes.string,
    // Footer
    onCancelAll: PropTypes.func,
    onCancel: PropTypes.func,
    onSubmit: PropTypes.func,
    disabled: PropTypes.bool,
    editingGas: PropTypes.bool,
    handleCloseEditGas: PropTypes.func,
    // Gas Popover
    currentTransaction: PropTypes.object.isRequired,
    showAddToAddressBookModal: PropTypes.func,
    contact: PropTypes.object,
  };

  maybeRenderAddContact() {
    const { t } = this.context;
    const { showAddToAddressBookModal, toAddress, contact = {} } = this.props;

    if (contact.name || toAddress === undefined) {
      return null;
    }

    return (
      <Dialog
        type="message"
        className="send__dialog"
        onClick={() => showAddToAddressBookModal()}
      >
        {t('newAccountDetectedDialogMessage')}
      </Dialog>
    );
  }

  render() {
    const {
      showEdit,
      onEdit,
      fromName,
      fromAddress,
      toName,
      toEns,
      toNickname,
      toAddress,
      disabled,
      errorKey,
      errorMessage,
      contentComponent,
      action,
      title,
      titleComponent,
      subtitleComponent,
      hideSubtitle,
      detailsComponent,
      dataComponent,
      onCancelAll,
      onCancel,
      onSubmit,
      identiconAddress,
      nonce,
      unapprovedTxCount,
      assetImage,
      warning,
      totalTx,
      positionOfCurrentTx,
      nextTxId,
      prevTxId,
      showNavigation,
      onNextTx,
      firstTx,
      lastTx,
      ofText,
      requestsWaitingText,
      hideSenderToRecipient,
      showAccountInHeader,
      origin,
      ethGasPriceWarning,
      editingGas,
      handleCloseEditGas,
      currentTransaction,
    } = this.props;
    const renderAssetImage = contentComponent || !identiconAddress;

    return (
      <div className="page-container">
        <ConfirmPageContainerNavigation
          totalTx={totalTx}
          positionOfCurrentTx={positionOfCurrentTx}
          nextTxId={nextTxId}
          prevTxId={prevTxId}
          showNavigation={showNavigation}
          onNextTx={(txId) => onNextTx(txId)}
          firstTx={firstTx}
          lastTx={lastTx}
          ofText={ofText}
          requestsWaitingText={requestsWaitingText}
        />
        <ConfirmPageContainerHeader
          showEdit={showEdit}
          onEdit={() => onEdit()}
          showAccountInHeader={showAccountInHeader}
          accountAddress={fromAddress}
        >
          {hideSenderToRecipient ? null : (
            <SenderToRecipient
              senderName={fromName}
              senderAddress={fromAddress}
              recipientName={toName}
              recipientAddress={toAddress}
              recipientEns={toEns}
              recipientNickname={toNickname}
              assetImage={renderAssetImage ? assetImage : undefined}
            />
          )}
        </ConfirmPageContainerHeader>
        <div>{this.maybeRenderAddContact()}</div>
        {contentComponent || (
          <ConfirmPageContainerContent
            action={action}
            title={title}
            titleComponent={titleComponent}
            subtitleComponent={subtitleComponent}
            hideSubtitle={hideSubtitle}
            detailsComponent={detailsComponent}
            dataComponent={dataComponent}
            errorMessage={errorMessage}
            errorKey={errorKey}
            identiconAddress={identiconAddress}
            nonce={nonce}
            assetImage={assetImage}
            warning={warning}
            onCancelAll={onCancelAll}
            onCancel={onCancel}
            cancelText={this.context.t('reject')}
            onSubmit={onSubmit}
            submitText={this.context.t('confirm')}
            disabled={disabled}
            unapprovedTxCount={unapprovedTxCount}
            rejectNText={this.context.t('rejectTxsN', [unapprovedTxCount])}
            origin={origin}
            ethGasPriceWarning={ethGasPriceWarning}
          />
        )}
        {contentComponent && (
          <PageContainerFooter
            onCancel={onCancel}
            cancelText={this.context.t('reject')}
            onSubmit={onSubmit}
            submitText={this.context.t('confirm')}
            submitButtonType="confirm"
            disabled={disabled}
          >
            {unapprovedTxCount > 1 && (
              <a onClick={onCancelAll}>
                {this.context.t('rejectTxsN', [unapprovedTxCount])}
              </a>
            )}
          </PageContainerFooter>
        )}
        {editingGas && (
          <EditGasPopover
            mode={EDIT_GAS_MODES.MODIFY_IN_PLACE}
            onClose={handleCloseEditGas}
            transaction={currentTransaction}
          />
        )}
      </div>
    );
  }
}

function mapStateToProps(state, ownProps) {
  const to = ownProps.toAddress;

  const contact = getAddressBookEntry(state, to);
  return {
    contact,
    toName: contact && contact.name ? contact.name : ownProps.toName,
    to,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    showAddToAddressBookModal: (recipient) =>
      dispatch(
        actions.showModal({
          name: 'ADD_TO_ADDRESSBOOK',
          recipient,
        }),
      ),
  };
}

function mergeProps(stateProps, dispatchProps, ownProps) {
  const { to, ...restStateProps } = stateProps;
  return {
    ...ownProps,
    ...restStateProps,
    showAddToAddressBookModal: () =>
      dispatchProps.showAddToAddressBookModal(to),
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
)(ConfirmPageContainer);
