import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { useMutation, useAction } from 'convex/react';
import { api } from '../convex/_generated/api';
import { colors, spacing, borderRadius, typography } from '../lib/theme';
import { setPlan } from '../lib/usageTracker';

export default function PaystackCheckoutScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const {
    publicKey, email, amount, reference, currency, productTitle,
    isSubscription, plan, userId, billingPeriod, purchaseType, creditAmount, purchaseLabel,
  } = route.params;
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [successRef, setSuccessRef] = useState<string | null>(null);
  const verifyPayment = useAction(api.paystack.verifyPayment);
  const verifySubscription = useAction(api.paystack.verifySubscription);

  const amountInSubunit = Math.round(amount * 100); // GHS to pesewas

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://js.paystack.co/v2/inline.js"></script>
      <style>
        body {
          margin: 0; padding: 0;
          background: #0A0E1A;
          display: flex; align-items: center; justify-content: center;
          height: 100vh;
          font-family: -apple-system, sans-serif;
          color: white;
        }
        .loading { text-align: center; }
        .loading p { margin-top: 12px; font-size: 14px; color: #94A3B8; }
      </style>
    </head>
    <body>
      <div class="loading" id="msg">
        <p>Initializing secure payment...</p>
      </div>
      <script>
        try {
          var popup = new PaystackPop();
          popup.checkout({
            key: '${publicKey}',
            email: '${email}',
            amount: ${amountInSubunit},
            ref: '${reference}',
            currency: '${currency || 'GHS'}',
            onSuccess: function(transaction) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'success',
                reference: transaction.reference
              }));
            },
            onCancel: function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'cancelled'
              }));
            },
            onError: function(error) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'error',
                message: error.message || 'Payment failed'
              }));
            }
          });
        } catch(e) {
          document.getElementById('msg').innerHTML = '<p style="color:#EF4444;">Failed to load payment. Please try again.</p>';
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'error',
            message: e.message || 'Failed to initialize payment'
          }));
        }
      </script>
    </body>
    </html>
  `;

  const doVerify = async (ref: string) => {
    setVerifying(true);
    setVerifyError(null);
    try {
      if (isSubscription) {
        const result = await verifySubscription({
          reference: ref,
          userId: userId,
          plan: plan,
          amount: amount,
          billingPeriod,
        });
        setVerifying(false);
        if (result.success) {
          await setPlan('pro');
          Alert.alert(
            'Subscription Confirmed',
            'Your subscription payment has been verified. Premium access is now active.',
            [{ text: 'Continue', onPress: () => nav.goBack() }]
          );
        } else {
          setVerifyError(result.error || 'Verification failed.');
        }
      } else {
        const result = await verifyPayment({
          reference: ref,
          userId,
          purchaseType,
          creditAmount,
          purchaseLabel,
        });
        setVerifying(false);
        if (result.success) {
          Alert.alert('Payment Confirmed', purchaseType === 'credit'
            ? 'Your payment voucher is confirmed and credits are now available.'
            : `You now have access to "${productTitle}". Check your Library.`, [
            { text: 'Go to Home', onPress: () => nav.goBack() },
            { text: 'OK', onPress: () => nav.goBack() },
          ]);
        } else {
          setVerifyError(result.error || 'Verification failed.');
        }
      }
    } catch (err: any) {
      setVerifying(false);
      setVerifyError(err.message || 'Connection error. Tap Retry.');
    }
  };

  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'success') {
        setSuccessRef(data.reference);
        doVerify(data.reference);
      } else if (data.type === 'cancelled') {
        Alert.alert('Payment Cancelled', 'You cancelled the payment.', [
          { text: 'OK', onPress: () => nav.goBack() },
        ]);
      } else if (data.type === 'error') {
        Alert.alert('Payment Error', data.message || 'Something went wrong.', [
          { text: 'OK', onPress: () => nav.goBack() },
        ]);
      }
    } catch (e) {
      // Ignore non-JSON messages
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
          <Ionicons name="close" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>
          {purchaseType === 'credit' ? 'Confirm Payment Voucher' : `Pay ${currency} ${amount.toFixed(2)}`}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {verifying || verifyError ? (
        <View style={s.center}>
          {verifying && !verifyError && (
            <>
              <ActivityIndicator size="large" color={colors.gold} />
              <Text style={s.verifyText}>Verifying payment...</Text>
            </>
          )}
          {verifyError && (
            <>
              <Ionicons name="alert-circle" size={48} color="#EF4444" />
              <Text style={s.errorText}>{verifyError}</Text>
              <TouchableOpacity
                style={s.retryBtn}
                onPress={() => successRef && doVerify(successRef)}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh" size={18} color={colors.textInverse} />
                <Text style={s.retryBtnText}>Retry Verification</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => nav.goBack()} style={{ marginTop: spacing.md }}>
                <Text style={s.skipText}>Go back</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <WebView
          source={{ html }}
          style={s.webview}
          onMessage={handleMessage}
          onLoadEnd={() => setLoading(false)}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={s.center}>
              <ActivityIndicator size="large" color={colors.gold} />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { padding: spacing.xs, marginRight: spacing.md },
  headerTitle: { ...typography.h3, color: colors.textPrimary, flex: 1 },
  webview: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  verifyText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  errorText: { ...typography.body, color: '#EF4444', textAlign: 'center', marginTop: spacing.sm },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.gold, paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md, borderRadius: borderRadius.full,
    marginTop: spacing.lg,
  },
  retryBtnText: { ...typography.bodyMedium, color: colors.textInverse },
  skipText: { ...typography.body, color: colors.textTertiary, textDecorationLine: 'underline' },
});