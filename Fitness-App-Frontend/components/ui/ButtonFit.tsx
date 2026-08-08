import { theme } from '@/constants/theme';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useRef, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Animated, Image, ImageSourcePropType, Platform } from 'react-native';
import { BlurView } from 'expo-blur';

interface ButtonFitProps {
    title: string;
    backgroundColor: string;
    hasBorder?: boolean;
    onPress: () => void;
    style?: object;
    isLoading?: boolean;
    loadingText?: string;
    hasMoreInfo?: boolean;
    moreInfoColor?: string;
    moreInfoTitle?: string;
    moreInfoIcon?: string;
    moreInfoText?: string;
    moreInfoImageSource?: ImageSourcePropType;
}

const ButtonFit: React.FC<ButtonFitProps> = ({
    title,
    backgroundColor,
    onPress,
    style,
    isLoading = false,
    loadingText = "Loading...",
    hasMoreInfo = false,
    moreInfoColor = theme.deepPrimary,
    moreInfoTitle = "Info",
    moreInfoIcon = "information",
    moreInfoText = "Additional information",
    moreInfoImageSource
}) => {
    const rotateAnim = useRef(new Animated.Value(0)).current;

    // Rotation animation
    useEffect(() => {
        if (isLoading) {
            const rotateAnimation = Animated.loop(
                Animated.timing(rotateAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                })
            );
            rotateAnimation.start();
            return () => rotateAnimation.stop();
        } else {
            rotateAnim.setValue(0);
        }
    }, [isLoading]);

    const rotateInterpolate = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <View style={styles.outerWrapper}>
            {hasMoreInfo && (
                <View style={[styles.infoCardWrapper, { backgroundColor: moreInfoColor }]}>
                    <View style={styles.infoContent}>
                        {moreInfoImageSource ? (
                            <Image
                                source={moreInfoImageSource}
                                style={styles.infoImage}
                            />
                        ) : (
                            <MaterialCommunityIcons
                                name={moreInfoIcon as any}
                                size={32}
                                color="#FFFFFF"
                                style={styles.infoIcon}
                            />
                        )}
                        <View style={styles.infoTextContainer}>
                            <Text style={styles.infoTitle}>{moreInfoTitle}</Text>
                            <Text style={styles.infoUndertext}>{moreInfoText}</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={[
                            styles.button,
                            styles.infoButton,
                            Platform.OS === 'ios' ? { backgroundColor: 'transparent', overflow: 'hidden' } : { backgroundColor: backgroundColor }
                        ]}
                        onPress={onPress}
                        disabled={isLoading}
                        activeOpacity={0.8}
                    >
                        {Platform.OS === 'ios' && (
                            <>
                                <BlurView intensity={100} tint="systemChromeMaterialDark" style={StyleSheet.absoluteFill} />
                                <View style={[StyleSheet.absoluteFill, { backgroundColor: backgroundColor, opacity: 0.5 }]} />
                            </>
                        )}
                        {isLoading ? (
                            <View style={styles.loadingContainer}>
                                <Animated.View style={[
                                    styles.loadingIcon,
                                    { transform: [{ rotate: rotateInterpolate }] }
                                ]}>
                                    <Ionicons name="sync-outline" size={20} color="#000" />
                                </Animated.View>
                                <Text style={styles.text}>{loadingText}</Text>
                            </View>
                        ) : (
                            <Text style={styles.text}>{title}</Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}
            {!hasMoreInfo && (
                <TouchableOpacity
                    style={[
                        styles.button,
                        styles.standaloneButton,
                        Platform.OS === 'ios' ? { backgroundColor: 'transparent', overflow: 'hidden' } : { backgroundColor: backgroundColor },
                        isLoading && styles.buttonDisabled,
                        style
                    ]}
                    onPress={onPress}
                    disabled={isLoading}
                    activeOpacity={0.8}
                >
                    {Platform.OS === 'ios' && (
                        <>
                            <BlurView intensity={100} tint="systemChromeMaterialDark" style={StyleSheet.absoluteFill} />
                            <View style={[StyleSheet.absoluteFill, { backgroundColor: backgroundColor, opacity: 0.5 }]} />
                        </>
                    )}
                    {isLoading ? (
                        <View style={styles.loadingContainer}>
                            <Animated.View style={[
                                styles.loadingIcon,
                                { transform: [{ rotate: rotateInterpolate }] }
                            ]}>
                                <Ionicons name="sync-outline" size={20} color="#000" />
                            </Animated.View>
                            <Text style={styles.text}>{loadingText}</Text>
                        </View>
                    ) : (
                        <Text style={styles.text}>{title}</Text>
                    )}
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    outerWrapper: {
        alignItems: 'center',
        alignSelf: 'center',
    },
    infoCardWrapper: {
        width: 330,
        borderRadius: 30,
        padding: 12,
        paddingBottom: 10,
    },
    infoContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 15,
    },
    infoIcon: {
        marginRight: 12,
        marginTop: 2,
    },
    infoImage: {
        width: 30,
        height: 30,
        marginRight: 12,
        marginTop: 2,
    },
    infoTextContainer: {
        flex: 1,
    },
    infoTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: theme.medium,
        marginBottom: 4,
    },
    infoUndertext: {
        color: '#FFFFFF',
        fontSize: 13,
        fontFamily: theme.light,
        lineHeight: 18,
    },
    button: {
        height: 63,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    standaloneButton: {
        width: 330,
    },
    infoButton: {
        width: '100%',
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingIcon: {
        marginRight: 8,
    },
    text: {
        color: '#000000',
        fontSize: 20,
        fontFamily: theme.medium,
    },
});


export default ButtonFit;