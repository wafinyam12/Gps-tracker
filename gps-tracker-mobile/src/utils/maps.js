import { Linking } from 'react-native';

const toCoordinateNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

export const getValidCoordinates = (target) => {
  const latitude = toCoordinateNumber(target?.latitude ?? target?.location?.latitude);
  const longitude = toCoordinateNumber(target?.longitude ?? target?.location?.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
};

export const canOpenRoute = (target) => getValidCoordinates(target) !== null;

export const buildGoogleMapsRouteUrl = (target) => {
  const coordinates = getValidCoordinates(target);

  if (!coordinates) {
    return null;
  }

  const destination = `${coordinates.latitude},${coordinates.longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
};

export const openGoogleMapsRoute = async (target) => {
  const url = buildGoogleMapsRouteUrl(target);

  if (!url) {
    return false;
  }

  await Linking.openURL(url);
  return true;
};
