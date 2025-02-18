import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontStyles } from '../../../styles/common';
import Engine from '../../../core/Engine';
import SignatureRequest from '../SignatureRequest';
import { util } from 'gopocket-core';
import PromptView from '../PromptView';
import { strings } from '../../../../locales/i18n';
import { renderError } from '../../../util/error';

const styles = StyleSheet.create({
	messageText: {
		fontSize: 14,
		color: colors.fontPrimary,
		...fontStyles.normal,
		textAlign: 'center'
	},
	textLeft: {
		textAlign: 'left'
	}
});

/**
 * Component that supports personal_sign
 */
export default class PersonalSign extends PureComponent {
	static propTypes = {
		/**
		 * Callback triggered when this message signature is rejected
		 */
		onCancel: PropTypes.func,
		/**
		 * Callback triggered when this message signature is approved
		 */
		onConfirm: PropTypes.func,
		/**
		 * Personal message to be displayed to the user
		 */
		messageParams: PropTypes.object,
		/**
		 * Object containing current page title and url
		 */
		currentPageInformation: PropTypes.object
	};

	state = {
		truncateMessage: false,
		error: null
	};

	signMessage = async () => {
		const { messageParams } = this.props;
		const { KeyringController, PersonalMessageManager } = Engine.context;
		const messageId = messageParams.metamaskId;
		const cleanMessageParams = await PersonalMessageManager.approveMessage(messageParams);
		const rawSig = await KeyringController.signPersonalMessage(cleanMessageParams);
		await PersonalMessageManager.setMessageStatusSigned(messageId, rawSig);
	};

	rejectMessage = async () => {
		const { messageParams } = this.props;
		const { PersonalMessageManager } = Engine.context;
		const messageId = messageParams.metamaskId;
		await PersonalMessageManager.rejectMessage(messageId);
	};

	cancelSignature = async () => {
		await this.rejectMessage();
		this.props.onCancel();
	};

	confirmSignature = async () => {
		try {
			await this.signMessage();
			this.props.onConfirm();
		} catch (error) {
			this.setState({ error: renderError(error) });
		}
	};

	renderMessageText = () => {
		const { messageParams } = this.props;
		const { truncateMessage } = this.state;

		return truncateMessage ? (
			<Text numberOfLines={5} ellipsizeMode={'tail'}>
				{messageParams.data}
			</Text>
		) : (
			<Text onTextLayout={this.shouldTruncateMessage}>{messageParams.data}</Text>
		);
	};

	shouldTruncateMessage = e => {
		if (e.nativeEvent.lines.length > 5) {
			this.setState({ truncateMessage: true });
			return;
		}
		this.setState({ truncateMessage: false });
	};

	render() {
		const { currentPageInformation } = this.props;
		return (
			<SignatureRequest
				onCancel={this.cancelSignature}
				onConfirm={this.confirmSignature}
				currentPageInformation={currentPageInformation}
				messageParams={this.props.messageParams}
				type="personalSign"
			>
				<View style={styles.messageWrapper}>{this.renderMessageText()}</View>
				<PromptView
					isVisible={this.state.error != null}
					title={strings('transactions.transaction_error')}
					message={this.state.error}
					onRequestClose={() => {
						this.setState({ error: null });
					}}
				/>
			</SignatureRequest>
		);
	}
}
