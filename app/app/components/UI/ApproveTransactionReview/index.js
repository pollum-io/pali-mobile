/* eslint-disable react/prop-types */
import React, { PureComponent } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Image } from 'react-native';
import PropTypes from 'prop-types';
import { colors, fontStyles, baseStyles } from '../../../styles/common';
import { connect } from 'react-redux';
import { getActiveUrl, getHost } from '../../../util/browser';
import { renderShortAddress } from '../../../util/address';
import { strings } from '../../../../locales/i18n';
import {
	toTokenMinimalUnit,
	isDecimal,
	renderAmount,
	getTokenDecimals,
	getAssetSymbol,
	getChainTypeByChainId
} from '../../../util/number';
import { getNormalizedTxState, getMethodData, decodeApproveData } from '../../../util/transactions';
import TransactionHeader from '../../UI/TransactionHeader';
import { WALLET_CONNECT_ORIGIN } from '../../../util/walletconnect';
import { withNavigation } from 'react-navigation';
import NetworkFee from '../NetworkFee';
import LinearGradient from 'react-native-linear-gradient';
import { onEvent } from '../../../util/statistics';
import { toLowerCaseEquals } from '../../../util/general';
import { chainToChainType } from '../../../util/ChainTypeImages';

const styles = StyleSheet.create({
	root: {
		width: '100%',
		paddingLeft: 30,
		paddingRight: 30,
		paddingTop: 30
	},
	title: {
		...fontStyles.bold,
		fontSize: 20,
		textAlign: 'center',
		color: colors.$202020,
		lineHeight: 28,
		paddingHorizontal: 20
	},
	fromWrapper: {
		marginTop: 26,
		flexDirection: 'row',
		alignItems: 'center'
	},
	toWrapper: {
		marginTop: 12,
		flexDirection: 'row',
		alignItems: 'center'
	},
	addressTitle: {
		width: 51,
		color: colors.$030319,
		...fontStyles.bold,
		fontSize: 16
	},
	address: {
		color: colors.$60657D,
		fontSize: 12
	},
	limitTitle: {
		color: colors.$030319,
		...fontStyles.bold,
		fontSize: 16,
		marginTop: 18
	},
	limitWrapper: {
		minWidth: '100%',
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 10,
		marginBottom: 16
	},
	selectBox: {
		width: 20,
		height: 20,
		backgroundColor: colors.$19C54C,
		borderColor: colors.$069531,
		borderWidth: 1,
		borderRadius: 20
	},
	unselectBox: {
		backgroundColor: colors.$F6F6F6,
		borderColor: colors.$C8C8C8
	},
	infinite: {
		color: colors.$030319,
		fontSize: 15,
		...fontStyles.normal,
		marginLeft: 9
	},
	inputLimit: {
		color: colors.$A5A5A5,
		fontSize: 24,
		...fontStyles.bold,
		lineHeight: 33,
		borderColor: colors.$8F92A13D,
		borderBottomWidth: 1,
		textAlign: 'center',
		minWidth: 86,
		maxWidth: 150
	},
	selectBtn: {
		flexDirection: 'row',
		alignItems: 'center'
	},
	securityPanel: {
		width: '100%',
		minHeight: 50,
		paddingTop: 12,
		paddingBottom: 12,
		marginTop: 12,
		flexDirection: 'row',
		alignItems: 'center',
		borderRadius: 5
	},
	securityImage1: {
		position: 'absolute',
		left: 15,
		bottom: 0,
		width: 47,
		height: 41
	},
	securityImage2: {
		position: 'absolute',
		left: 15,
		bottom: 0,
		width: 49,
		height: 49
	},
	securityText0: {
		flex: 1,
		marginLeft: 20,
		marginRight: 15,
		fontSize: 12,
		...fontStyles.medium,
		lineHeight: 18,
		color: colors.white
	},
	securityText: {
		width: 240,
		marginLeft: 72,
		fontSize: 12,
		...fontStyles.medium,
		lineHeight: 18,
		color: colors.white
	},
	commonRiskBtn: {
		height: 32,
		paddingLeft: 10,
		paddingRight: 10,
		marginRight: 14,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: colors.white,
		borderRadius: 5
	},
	commonRiskBtnText: {
		...fontStyles.medium,
		fontSize: 12,
		color: colors.$8C9CDA
	}
});

/**
 * PureComponent that manages ERC20 approve from the dapp browser
 */
class ApproveTransactionReview extends PureComponent {
	static propTypes = {
		/**
		 * Transaction state
		 */
		transaction: PropTypes.object.isRequired,
		/**
		 * Callback triggered when gas fee is selected
		 */
		handleGasFeeSelection: PropTypes.func,
		setApproveAmount: PropTypes.func,
		browser: PropTypes.object
	};

	state = {
		ready: false,
		isInfiniteLimit: true,
		host: undefined,
		originalApproveAmount: undefined,
		tokenSymbol: undefined,
		spenderAddress: '0x...',
		transaction: this.props.transaction,
		gasPriceBNWei: undefined,
		token: {},
		limitValue: '',
		limitValueFormat: '',
		securityLevel: 0 //0: unknown; 1: safe; 2: risk
	};

	customSpendLimitInput = React.createRef();
	originIsWalletConnect = this.props.transaction.origin?.includes(WALLET_CONNECT_ORIGIN);

	componentDidMount = async () => {
		const {
			transaction: { origin, to, data, chainId },
			setApproveAmount,
			contractList
		} = this.props;
		const host = getHost(this.originIsWalletConnect ? origin.split(WALLET_CONNECT_ORIGIN)[1] : origin);
		let tokenSymbol, tokenDecimals;
		try {
			const type = getChainTypeByChainId(chainId);
			tokenDecimals = await getTokenDecimals(type, to);
			tokenSymbol = await getAssetSymbol(type, to);
		} catch (e) {
			tokenSymbol = 'ERC20 Token';
			tokenDecimals = 18;
		}
		const { spenderAddress, encodedAmount } = decodeApproveData(data);
		setApproveAmount(encodedAmount, spenderAddress);
		const { name: method } = await getMethodData(data);

		const type = getChainTypeByChainId(chainId);
		const spenderInfo = contractList?.find(
			contract => chainToChainType(contract.chain) === type && toLowerCaseEquals(contract.address, spenderAddress)
		);
		if (spenderInfo && spenderInfo.status === 1) {
			onEvent('SafeApproval');
		} else if (spenderInfo && spenderInfo.status === 2) {
			onEvent('RiskApproval');
		}
		const initAmount = parseInt(encodedAmount);
		this.setState({
			host,
			method,
			originalApproveAmount: encodedAmount,
			tokenSymbol,
			token: { symbol: tokenSymbol, decimals: tokenDecimals },
			spenderAddress,
			securityLevel: spenderInfo?.status || 0,
			isInfiniteLimit: initAmount !== 0,
			limitValue: initAmount !== 0 ? '' : '0',
			limitValueFormat: initAmount !== 0 ? '' : '0'
		});
	};

	onLimitChange = customLimit => {
		let limit = customLimit;
		if (customLimit === undefined || !isDecimal(customLimit)) {
			limit = '0';
		}
		const { token } = this.state;
		const uint = toTokenMinimalUnit(limit, token.decimals).toString();
		this.props.setApproveAmount(Number(uint).toString(16), this.state.spenderAddress);
		const limitValueFormat = renderAmount(customLimit);
		this.setState({ limitValue: customLimit, limitValueFormat });
	};

	onGasChange = (gasPriceBNWei, maxPriorityFeePerGasBN, maxFeePerGasBN, estimatedBaseFeeBN, limitGas) => {
		this.setState({ gasPriceBNWei, ready: true });

		this.props.handleGasFeeSelection &&
			this.props.handleGasFeeSelection(
				gasPriceBNWei,
				maxPriorityFeePerGasBN,
				maxFeePerGasBN,
				estimatedBaseFeeBN,
				limitGas
			);
	};

	onLimitSelectChange = () => {
		this.setState({ isInfiniteLimit: !this.state.isInfiniteLimit }, () => {
			if (this.state.isInfiniteLimit) {
				this.props.setApproveAmount(this.state.originalApproveAmount, this.state.spenderAddress);
			} else {
				this.onLimitChange(this.state.limitValue);
			}
		});
	};

	onLimitInputFocus = () => {
		if (this.state.isInfiniteLimit) {
			this.onLimitSelectChange();
		}
	};

	renderSecurityPanel = () => {
		const { securityLevel } = this.state;
		if (securityLevel === 1) {
			return (
				<LinearGradient
					start={{ x: 0, y: 0 }}
					end={{ x: 1, y: 0 }}
					colors={['#20D074', '#13D199']}
					style={styles.securityPanel}
				>
					<Image
						style={styles.securityImage1}
						source={require('../../../images/approval_security_safe.png')}
					/>
					<Text style={styles.securityText}>{strings('security.approve_spender_safe')}</Text>
				</LinearGradient>
			);
		}
		if (securityLevel === 2) {
			return (
				<LinearGradient
					start={{ x: 0, y: 0 }}
					end={{ x: 1, y: 0 }}
					colors={['#FF9595', '#FD5E5E']}
					style={styles.securityPanel}
				>
					<Image
						style={styles.securityImage2}
						source={require('../../../images/approval_security_risk.png')}
					/>
					<Text style={styles.securityText}>{strings('security.approve_spender_risk')}</Text>
				</LinearGradient>
			);
		}
		return (
			<LinearGradient
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 0 }}
				colors={['#ADB8E2', '#8798D9']}
				style={styles.securityPanel}
			>
				<Text style={styles.securityText0}>{strings('security.approve_spender_unknown')}</Text>
				<TouchableOpacity style={styles.commonRiskBtn} activeOpacity={0.6} onPress={this.props.showCommonRisk}>
					<Text style={styles.commonRiskBtnText}>{strings('security.common_risk')}</Text>
				</TouchableOpacity>
			</LinearGradient>
		);
	};

	render = () => {
		const {
			host,
			tokenSymbol,
			spenderAddress,
			isInfiniteLimit,
			ready,
			limitValueFormat,
			originalApproveAmount
		} = this.state;

		const {
			transaction,
			browser,
			transaction: { origin }
		} = this.props;

		const activeTabUrl = getActiveUrl(browser);

		const type = getChainTypeByChainId(transaction.chainId);

		const originalAmount = parseInt(originalApproveAmount);
		const title =
			originalAmount === 0
				? strings('spend_limit_edition.titleCancel', { tokenSymbol })
				: strings('spend_limit_edition.title', { tokenSymbol });
		const approveLimitText = originalAmount === 0 ? strings('other.amend_limit') : strings('other.approve_limit');
		return (
			<View style={styles.root} testID={'approve-screen'}>
				<Text style={styles.title}>{title}</Text>
				<TransactionHeader
					currentPageInformation={{ origin, spenderAddress, title: host, url: activeTabUrl }}
				/>
				{this.renderSecurityPanel()}
				<View style={styles.fromWrapper}>
					<Text style={styles.addressTitle}>{strings('other.from')}</Text>
					<Text style={styles.address}>{renderShortAddress(transaction.from, 17)}</Text>
				</View>
				<View style={styles.toWrapper}>
					<Text style={styles.addressTitle}>{strings('other.to')}</Text>
					<Text style={styles.address}>{renderShortAddress(transaction.to, 17)}</Text>
				</View>
				<Text style={styles.limitTitle}>{approveLimitText}</Text>
				<View style={styles.limitWrapper}>
					<TouchableOpacity
						style={styles.selectBtn}
						onPress={isInfiniteLimit ? null : this.onLimitSelectChange}
						disabled={!ready}
					>
						<View style={[styles.selectBox, !isInfiniteLimit && styles.unselectBox]} />
						<Text style={styles.infinite}>{strings('other.infinite')}</Text>
					</TouchableOpacity>

					<View style={baseStyles.flexGrow} />

					<TouchableOpacity
						style={[styles.selectBox, isInfiniteLimit && styles.unselectBox]}
						onPress={!isInfiniteLimit ? null : this.onLimitSelectChange}
						disabled={!ready}
					/>
					<TextInput
						style={styles.inputLimit}
						keyboardType="numeric"
						onChangeText={this.onLimitChange}
						placeholder={'0'}
						placeholderTextColor={colors.$A5A5A5}
						autoCapitalize="none"
						onFocus={this.onLimitInputFocus}
						editable={ready}
						value={limitValueFormat}
					/>
				</View>
				<NetworkFee transaction={transaction.transaction} type={type} onChange={this.onGasChange} />
			</View>
		);
	};
}

const mapStateToProps = state => ({
	transaction: getNormalizedTxState(state),
	browser: state.browser,
	contractList: state.settings.contractList
});

const mapDispatchToProps = dispatch => ({});

export default connect(
	mapStateToProps,
	mapDispatchToProps
)(withNavigation(ApproveTransactionReview));
