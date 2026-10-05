import { Alert } from 'react-native';

export const confirmLocationDisclosure = ({ title, message }) => new Promise((resolve) => {
  Alert.alert(title, message, [
    { text: 'Batal', style: 'cancel', onPress: () => resolve(false) },
    { text: 'Lanjutkan', onPress: () => resolve(true) },
  ], { cancelable: false });
});
