import React, { PureComponent } from 'react';
import { isImageFile, isMp3File, isSvgFile, isVideoFile } from '../../../util/general';
import FastImage from 'react-native-fast-image';
import PropTypes from 'prop-types';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../../styles/common';
import { util } from 'gopocket-core';
import Engine from '../../../core/Engine';
import RNFetchBlob from 'rn-fetch-blob';
import Video from 'react-native-video';
import { addAudioUrl, addImageUrl, addOutOfMemoryUrl, addVideoUrl } from '../../../actions/nft';
import { connect } from 'react-redux';
import convertToProxyURL from 'react-native-video-cache';
import { SvgCssUri } from 'react-native-svg';
import SvgImage from '../SvgImage';

export const convertImageUrl = imageUrl => {
	if (util.isIPFSUrl(imageUrl)) {
		imageUrl = util.makeIPFSUrl(imageUrl, Engine.context.CollectiblesController.state.ipfsGateway);
	}
	//TODO: update api url to Pali ones
	if (imageUrl && imageUrl.startsWith('https://api.gopocket.finance/proxy-png?url=')) {
		return imageUrl;
	}
	if (!util.isEtherscanAvailable() && !!imageUrl && !isVideoFile(imageUrl)) {
		//TODO: update api url to Pali ones
		imageUrl = 'https://api.gopocket.finance/proxy-png?url=' + imageUrl;
	} else if (!!imageUrl && imageUrl.startsWith('http://')) {
		//TODO: update api url to Pali ones
		imageUrl = 'https://api.gopocket.finance/proxy-png?url=' + imageUrl;
	}
	return imageUrl;
};

const styles = StyleSheet.create({
	borderStyle: {
		borderWidth: 1,
		borderColor: colors.$F0F0F0
	},
	videoLayout: {
		justifyContent: 'center',
		alignSelf: 'center',
		backgroundColor: colors.black
	},
	bgBlack: {
		backgroundColor: colors.black
	},
	svgBorderRadius: {
		overflow: 'hidden'
	}
});

class NFTImage extends PureComponent {
	static propTypes = {
		videoUrls: PropTypes.array,
		imageUrls: PropTypes.array,
		audioUrls: PropTypes.array,
		outofMemoryUrls: PropTypes.array,
		addVideoUrl: PropTypes.func,
		addImageUrl: PropTypes.func,
		addAudioUrl: PropTypes.func,
		addOutOfMemoryUrl: PropTypes.func,

		imageUrl: PropTypes.string,
		style: PropTypes.any,
		onLoadEnd: PropTypes.func,
		onLoad: PropTypes.func,
		defaultImg: PropTypes.any,
		showBorder: PropTypes.bool,
		resizeMode: PropTypes.string,
		isBlurBg: PropTypes.bool,
		svgUseWebView: PropTypes.bool,
		isThumbnail: PropTypes.bool
	};

	state = {
		isVideoUrl: false,
		isImageUrl: false,
		isAudioUrl: false,
		isSvgUrl: false,
		imageLoadingError: false,
		defaultLoadingError: false,
		parseError: false
	};

	refImage = React.createRef();

	UNSAFE_componentWillMount = () => {
		const urlValue = convertImageUrl(this.props.imageUrl);
		if (!urlValue || !urlValue.startsWith('http')) {
			return;
		}
		const {
			videoUrls,
			imageUrls,
			audioUrls,
			addVideoUrl,
			addImageUrl,
			addAudioUrl,
			addOutOfMemoryUrl
		} = this.props;
		if (isImageFile(urlValue) || imageUrls.indexOf(urlValue) !== -1) {
			this.setState({ isImageUrl: true });
			// eslint-disable-next-line no-empty
		} else if (isVideoFile(urlValue) || videoUrls.indexOf(urlValue) !== -1) {
			this.setState({ isVideoUrl: true });
		} else if (isMp3File(urlValue) || audioUrls.indexOf(urlValue) !== -1) {
			this.setState({ isAudioUrl: true });
			// eslint-disable-next-line no-empty
		} else if (isSvgFile(urlValue)) {
		} else {
			const task = RNFetchBlob.fetch('GET', urlValue);
			task.then(res => {
				const status = res.info()?.status;
				if (status === 200) {
					const contentType = res.info()?.headers['Content-Type']?.toLowerCase();
					if (contentType) {
						if (contentType.startsWith('video/')) {
							this.setState({ isVideoUrl: true });
							addVideoUrl(urlValue);
						} else if (contentType.startsWith('image/')) {
							this.setState({ isImageUrl: true });
							addImageUrl(urlValue);
						} else if (contentType.startsWith('audio/')) {
							this.setState({ isAudioUrl: true });
							addAudioUrl(urlValue);
						}
					}
					if (res.info()?.headers['Content-Length'] && res.info().headers['Content-Length'] > 1024 * 1024) {
						addOutOfMemoryUrl(urlValue);
					}
				}
			}).catch(err => {
				console.error(err);
			});
		}
	};

	handleSvgError = e => {
		if (e === 'parseError') {
			this.setState({ parseError: true });
		}
	};

	render() {
		const {
			style,
			onLoadEnd,
			onLoad,
			defaultImg,
			showBorder,
			resizeMode,
			isBlurBg,
			svgUseWebView,
			isThumbnail,
			outofMemoryUrls
		} = this.props;
		const {
			isVideoUrl,
			isImageUrl,
			isSvgUrl,
			isAudioUrl,
			imageLoadingError,
			defaultLoadingError,
			parseError
		} = this.state;
		const urlValue = convertImageUrl(this.props.imageUrl);

		let width = style?.width;
		let height = style?.height;
		if (style && !width && Array.isArray(style)) {
			style.forEach(item => {
				if (item.width) {
					width = item.width;
				}
				if (item.height) {
					height = item.height;
				}
			});
		}
		if (
			!urlValue ||
			!urlValue.startsWith('http') ||
			isAudioUrl ||
			isMp3File(urlValue) ||
			parseError ||
			(isThumbnail && outofMemoryUrls.indexOf(urlValue) !== -1) //针对gif太大，造成列表奔溃
		) {
			return (
				<FastImage
					ref={this.refImage}
					style={style}
					source={defaultImg || require('../../../images/nft_default_placehoder.png')}
					resizeMode={resizeMode}
				/>
			);
		} else if (isImageUrl || isImageFile(urlValue)) {
			return (
				<FastImage
					ref={this.refImage}
					source={
						imageLoadingError
							? defaultImg || require('../../../images/nft_default_placehoder.png')
							: { uri: urlValue }
					}
					style={[style, showBorder && styles.borderStyle]}
					onLoadEnd={onLoadEnd}
					resizeMode={resizeMode}
					onLoad={onLoad}
					onError={() => {
						if (!imageLoadingError) {
							this.setState({ imageLoadingError: true });
						}
					}}
				/>
			);
		} else if (isVideoUrl || isVideoFile(urlValue)) {
			return (
				<View style={[style, showBorder && styles.borderStyle, isBlurBg && styles.bgBlack]}>
					<Video
						muted
						source={{ uri: convertToProxyURL(urlValue) }}
						style={[{ width, height }, styles.videoLayout]} //组件样式
						mixWithOthers={'mix'}
						useTextureView
						playWhenInactive
						playInBackground
						ignoreSilentSwitch="ignore"
						disableFocus
						repeat
					/>
				</View>
			);
		} else if (isSvgUrl || isSvgFile(urlValue)) {
			return (
				<View style={[style, styles.svgBorderRadius, showBorder && styles.borderStyle]}>
					{svgUseWebView ? (
						<SvgImage
							ref={this.refImage}
							style={{ width, height }}
							containerStyle={{ width, height }}
							source={{ uri: urlValue }}
						/>
					) : (
						<SvgCssUri
							ref={this.refImage}
							style={{ transform: [] }} // 该svg图片造成奔溃，所以加了transform. https://storage.opensea.io/files/0028f7cb022373227ed401d4549072a2.svg
							width={width}
							height={height}
							uri={urlValue}
							preserveAspectRatio="xMaxYMax slice"
							onError={this.handleSvgError}
						/>
					)}
				</View>
			);
		}
		return (
			<FastImage
				ref={this.refImage}
				source={
					defaultLoadingError
						? defaultImg || require('../../../images/nft_default_placehoder.png')
						: { uri: urlValue }
				}
				style={[style, showBorder && styles.borderStyle]}
				onLoadEnd={onLoadEnd}
				resizeMode={resizeMode}
				onLoad={onLoad}
				onError={() => {
					if (!defaultLoadingError) {
						this.setState({ defaultLoadingError: true });
					}
				}}
			/>
		);
	}

	setNativeProps(style) {
		this.refImage?.current?.setNativeProps(style);
	}
}

const mapStateToProps = state => ({
	videoUrls: state.nft.videoUrls,
	imageUrls: state.nft.imageUrls,
	audioUrls: state.nft.audioUrls,
	outofMemoryUrls: state.nft.outofMemoryUrls
});

const mapDispatchToProps = dispatch => ({
	addVideoUrl: url => dispatch(addVideoUrl(url)),
	addImageUrl: url => dispatch(addImageUrl(url)),
	addAudioUrl: url => dispatch(addAudioUrl(url)),
	addOutOfMemoryUrl: url => dispatch(addOutOfMemoryUrl(url))
});

export default connect(
	mapStateToProps,
	mapDispatchToProps
)(NFTImage);
