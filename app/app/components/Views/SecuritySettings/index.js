import React, { PureComponent } from 'react';
import { toggleShowHint } from '../../../actions/hint';
import { connect } from 'react-redux';
import { strings } from '../../../../locales/i18n';
import { ScrollView, StyleSheet } from 'react-native';
import { baseStyles, colors, fontStyles } from '../../../styles/common';
import MStatusBar from '../../UI/MStatusBar';
import PropTypes from 'prop-types';
import SettingsDrawer from '../../UI/SettingsDrawer';
import SettingsSwitch from '../../UI/SettingsSwitch';
import Device from '../../../util/Device';
import AsyncStorage from '@react-native-community/async-storage';
import { BIOMETRY_CHOICE, BIOMETRY_CHOICE_DISABLED, TRUE, VERIFICATION_DISABLED } from '../../../constants/storage';
import SecureKeychain from '../../../core/SecureKeychain';
import Engine from '../../../core/Engine';
import { util } from 'gopocket-core';
import CheckPassword from '../../UI/CheckPassword';
import PromptView from '../../UI/PromptView';
import TitleBar from '../../UI/TitleBar';
import { SafeAreaView } from 'react-native-safe-area-context';

const styles = StyleSheet.create({
	wrapper: {
		backgroundColor: colors.white,
		flex: 1,
		paddingHorizontal: 20
	},
	title: {
		fontSize: 16,
		...fontStyles.normal,
		color: colors.$030319
	},
	settingDrawerStyle: {
		marginHorizontal: 0
	}
});

const CheckTypeBiometry = 'CHECK_TYPE_BIOMETRY';
const CheckTypeVerification = 'CHECK_TYPE_VERIFICATION';

class SecuritySettings extends PureComponent {
	static propTypes = {
		/**
		/* navigation object required to push new views
		 */
		navigation: PropTypes.object
	};

	state = {
		biometryChoice: false,
		isBiometryType: false,
		verificationChoice: true,
		checkPasswordType: undefined,
		onlyCheckInputPwd: false,
		error: null
	};

	componentDidMount() {
		this.loadState();
	}

	loadState = async () => {
		let biometryChoice = false;
		let isBiometryType = false;
		const choice = await AsyncStorage.getItem(BIOMETRY_CHOICE);
		const disabled = await AsyncStorage.getItem(BIOMETRY_CHOICE_DISABLED);
		if (choice) {
			biometryChoice = !disabled;
			isBiometryType = true;
		} else if (await SecureKeychain.getSupportedBiometryType()) {
			biometryChoice = !disabled;
			isBiometryType = true;
		} else if (Device.isIos()) {
			biometryChoice = !disabled;
			isBiometryType = true;
		} else if (await SecureKeychain.getGenericPassword()) {
			biometryChoice = true;
			isBiometryType = false;
		}

		const verificationChoice = await AsyncStorage.getItem(VERIFICATION_DISABLED);
		this.setState({ biometryChoice, isBiometryType, verificationChoice: !verificationChoice });
	};

	onResetPassword = () => {
		this.props.navigation.navigate('ResetPassword');
	};

	onBiometryChange = async choice => {
		try {
			if (choice) {
				if (this.state.isBiometryType && !(await SecureKeychain.getSupportedBiometryType())) {
					this.setState({ error: strings(`biometrics.rejectBiometry`) });
					return;
				}
				this.setState({ onlyCheckInputPwd: true, checkPasswordType: CheckTypeBiometry });
			} else {
				await SecureKeychain.resetGenericPassword();
				await AsyncStorage.setItem(BIOMETRY_CHOICE_DISABLED, TRUE);
			}
		} catch (e) {
			util.logDebug('PPYang onBiometryChange e:', e);
			return;
		}
		this.setState({ biometryChoice: choice });
	};

	onVerificationChange = async choice => {
		this.setState({
			verificationChoice: choice,
			onlyCheckInputPwd: false,
			checkPasswordType: CheckTypeVerification
		});
	};

	onInputPwdResult = async result => {
		const { checkPasswordType } = this.state;
		if (checkPasswordType === CheckTypeBiometry) {
			if (result) {
				try {
					await SecureKeychain.resetGenericPassword();
					const pwd = await Engine.context.KeyringController.getPassword();
					await SecureKeychain.setGenericPassword(
						pwd,
						this.state.isBiometryType ? SecureKeychain.TYPES.BIOMETRICS : SecureKeychain.TYPES.REMEMBER_ME
					);
				} catch (e) {
					util.logError('PPYang SecuritySettings onInputPwdResult e:', e);
					this.setState({ biometryChoice: false });
					return;
				}
			}
			this.setState({ biometryChoice: result });
		} else if (checkPasswordType === CheckTypeVerification) {
			if (result) {
				if (this.state.verificationChoice) {
					await AsyncStorage.removeItem(VERIFICATION_DISABLED);
				} else {
					await AsyncStorage.setItem(VERIFICATION_DISABLED, TRUE);
				}
			} else {
				this.setState({ verificationChoice: !this.state.verificationChoice });
			}
		}
		this.setState({ checkPasswordType: undefined });
	};

	render() {
		const {
			biometryChoice,
			isBiometryType,
			verificationChoice,
			checkPasswordType,
			onlyCheckInputPwd,
			error
		} = this.state;
		return (
			<SafeAreaView style={baseStyles.flexGrow} testID={'wallet-screen'}>
				<MStatusBar navigation={this.props.navigation} fixPadding={false} />
				<TitleBar
					title={strings('app_settings.security_settings')}
					onBack={() => {
						this.props.navigation.pop();
					}}
				/>
				<ScrollView style={styles.wrapper} keyboardShouldPersistTaps="handled">
					<SettingsDrawer
						onPress={this.onResetPassword}
						title={strings('app_settings.change_password')}
						titleStyle={styles.title}
						baseStyle={styles.settingDrawerStyle}
					/>
					<SettingsSwitch
						message={strings(
							isBiometryType
								? Device.isIos()
									? 'app_settings.use_id_message'
									: 'app_settings.use_biometrics_message'
								: 'app_settings.keep_login_message'
						)}
						title={strings(
							isBiometryType
								? Device.isIos()
									? 'app_settings.use_id'
									: 'app_settings.use_biometrics'
								: 'app_settings.keep_login'
						)}
						value={biometryChoice}
						onValueChange={this.onBiometryChange}
					/>
					<SettingsSwitch
						message={strings(
							Device.isIos()
								? 'app_settings.verification_message_for_id'
								: 'app_settings.verification_message_for_pwd'
						)}
						title={strings('app_settings.transaction_verification')}
						value={verificationChoice}
						onValueChange={this.onVerificationChange}
					/>
					{checkPasswordType && (
						<CheckPassword
							checkResult={this.onInputPwdResult}
							needDelay={false}
							onlyCheckInputPwd={onlyCheckInputPwd}
						/>
					)}
					<PromptView
						isVisible={error != null}
						title={strings('transactions.transaction_error')}
						message={error}
						onRequestClose={() => {
							this.setState({ error: null });
						}}
					/>
				</ScrollView>
			</SafeAreaView>
		);
	}
}

const mapStateToProps = state => ({});

const mapDispatchToProps = dispatch => ({
	toggleShowHint: hintText => dispatch(toggleShowHint(hintText))
});

export default connect(
	mapStateToProps,
	mapDispatchToProps
)(SecuritySettings);
