import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import { Camera, CheckCircle2, ClipboardList, MapPin, Save, Trash2 } from 'lucide-react-native';
import AppScreen from '../components/ui/AppScreen';
import AppButton from '../components/ui/AppButton';
import PageHeader from '../components/ui/PageHeader';
import Surface from '../components/ui/Surface';
import { colors, radii, shadows, spacing } from '../styles/theme';
import { normalizePhoneNumber } from '../utils/phone';
import { useAuth } from '../context/AuthContext';

const KYC_DRAFT_STORAGE_KEY = 'customer_kyc_drafts';

const REQUEST_TYPES = [
  { label: 'Penambahan', value: 'add', text: 'Pengajuan penambahan Customer.' },
  { label: 'Perubahan', value: 'update', text: 'Pengajuan perubahan data Customer.' },
];

const COMPANY_OPTIONS = [
  {
    label: 'JURTAP BANDUNG',
    value: 'JURTAP_BANDUNG',
    sapName: 'JURTAP BANDUNG',
    series: 103,
    groupCode: 104,
    dbName: null,
  },
  {
    label: 'UDMW',
    value: 'UDMW',
    sapName: 'UDMW',
    series: null,
    groupCode: null,
    dbName: null,
  },
  {
    label: 'UJASI',
    value: 'UJASI',
    sapName: 'UJASI',
    series: null,
    groupCode: null,
    dbName: null,
  },
];

const EMPTY_ATTACHMENTS = {
  ktpPhoto: null,
  npwpPhoto: null,
  purchaseHistoryPhoto: null,
  storePhoto: null,
};

const EMPTY_FORM = {
  ticketNumber: '',
  requestType: 'add',
  skuNumber: '',
  customerName: '',
  contactPerson: '',
  phone: '',
  email: '',
  addressStreet: '',
  rt: '',
  rw: '',
  district: '',
  city: '',
  county: '',
  province: '',
  zipCode: '',
  ktpAvailable: false,
  npwpAvailable: false,
  purchaseHistoryAvailable: false,
  nik: '',
  npwpNumber: '',
  npwpName: '',
  npwpAddress: '',
  storeLocation: null,
  attachments: { ...EMPTY_ATTACHMENTS },
  notes: '',
};

const SAMPLE_FORM = {
  ...EMPTY_FORM,
  customerName: 'SUSI AWATI (TB. SUMBER SALUYU)',
  contactPerson: 'SUSI AWATI',
  phone: '+62 813-2245-2712',
  addressStreet: 'JL. CICUKANG NO.39',
  district: 'ARCAMANIK',
  city: 'BANDUNG',
  county: 'BANDUNG',
  province: 'JAWA BARAT',
  ktpAvailable: true,
  npwpAvailable: true,
  purchaseHistoryAvailable: true,
  storeLocation: null,
  attachments: { ...EMPTY_ATTACHMENTS },
};

const toNull = (value) => {
  const text = value === null || value === undefined ? '' : String(value).trim();
  return text || null;
};

const selectedOption = (options, value) => (
  options.find((item) => item.value === value) || options[0]
);

const resolveCompanyFromUser = (user) => {
  const branch = user?.branch || user?.team || {};
  const branchName = branch.name || branch.code || 'Cabang Sales';
  const normalizedBranch = String(branchName).trim().toUpperCase();
  const matchedCompany = COMPANY_OPTIONS.find((item) => (
    normalizedBranch.includes(item.sapName)
    || normalizedBranch.includes(item.label)
    || String(branch.code || '').trim().toUpperCase() === item.value
  ));

  return {
    label: branchName,
    value: branch.code || branchName,
    sapName: branchName,
    series: matchedCompany?.series ?? null,
    groupCode: matchedCompany?.groupCode ?? null,
    dbName: branch.db_sap || matchedCompany?.dbName || null,
    branchId: branch.id ?? null,
    branchCode: branch.code ?? null,
  };
};

const addressPayload = (form, addressName, addressType) => {
  const buildingInfo = [
    form.rt ? `RT ${form.rt}` : null,
    form.rw ? `RW ${form.rw}` : null,
  ].filter(Boolean).join(' / ');

  return {
    AddressName: addressName,
    AddressType: addressType,
    Street: toNull(form.addressStreet),
    Block: toNull(form.district),
    City: toNull(form.city),
    County: toNull(form.county || form.city),
    State: null,
    Country: 'ID',
    ZipCode: toNull(form.zipCode),
    BuildingFloorRoom: buildingInfo,
  };
};

const documentText = (form) => {
  const documents = [
    form.ktpAvailable ? 'KTP tersedia' : 'KTP belum tersedia',
    form.npwpAvailable ? 'NPWP tersedia' : 'NPWP belum tersedia',
    form.purchaseHistoryAvailable ? 'riwayat pembelian tersedia' : 'riwayat pembelian belum tersedia',
  ];

  return documents.join(', ');
};

const buildSapPayload = (form, company) => {
  const requestType = selectedOption(REQUEST_TYPES, form.requestType);
  const npwpNumber = toNull(form.npwpNumber);

  return {
    CardCode: null,
    Series: company.series,
    CardName: toNull(form.customerName),
    CardType: 'cCustomer',
    CardForeignName: null,
    GroupCode: company.groupCode,
    Currency: 'IDR',
    FederalTaxID: npwpNumber,
    UnifiedFederalTaxID: npwpNumber,
    EmailAddress: toNull(form.email),
    Phone1: null,
    Cellular: normalizePhoneNumber(form.phone) || null,
    Fax: null,
    Website: null,
    ContactPerson: toNull(form.contactPerson),
    AdditionalID: null,
    FreeText: `${requestType.text} ${documentText(form)}.${form.notes ? ` ${form.notes.trim()}` : ''}`,
    SalesPersonCode: -1,
    PayTermsGrpCode: null,
    CreditLimit: 0,
    MaxCommitment: null,
    Valid: 'tYES',
    ValidFrom: null,
    ValidTo: null,
    ValidRemarks: null,
    Frozen: 'tNO',
    FrozenFrom: null,
    FrozenTo: null,
    FrozenRemarks: null,
    U_IDU_NamaNPWP: toNull(form.npwpName),
    U_IDU_AlmtNPWP: toNull(form.npwpAddress),
    U_IDU_NIK: toNull(form.nik),
    U_IDU_KDP: null,
    U_IDU_RatePajak: '11',
    U_RTS_DBNAME: company.dbName,
    AttachmentEntry: null,
    BilltoDefault: 'BILL TO',
    ShipToDefault: 'SHIP TO',
    BPAddresses: [
      addressPayload(form, 'BILL TO', 'bo_BillTo'),
      addressPayload(form, 'SHIP TO', 'bo_ShipTo'),
    ],
  };
};

const buildAttachmentDraft = (form) => ([
  { key: 'ktpPhoto', label: 'KTP / ID Card' },
  { key: 'npwpPhoto', label: 'NPWP / Tax Card' },
  { key: 'purchaseHistoryPhoto', label: 'Riwayat Pembelian' },
  { key: 'storePhoto', label: 'Foto Toko' },
]).map((item) => {
  const attachment = form.attachments?.[item.key];

  if (!attachment?.uri) {
    return null;
  }

  return {
    type: item.key,
    label: item.label,
    uri: attachment.uri,
    name: attachment.name,
    mime_type: attachment.type,
    captured_at: attachment.captured_at,
  };
}).filter(Boolean);

const buildStoreLocationDraft = (form) => {
  const location = form.storeLocation || null;

  if (!Number.isFinite(location?.latitude) || !Number.isFinite(location?.longitude)) {
    return null;
  }

  return {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy ?? null,
    recorded_at: location.recorded_at ?? null,
  };
};

const validateForm = (form) => {
  const errors = [];
  const attachments = form.attachments || {};

  if (!toNull(form.customerName)) errors.push('Nama customer wajib diisi.');
  if (!toNull(form.contactPerson)) errors.push('Nama PIC wajib diisi.');
  if (!normalizePhoneNumber(form.phone)) errors.push('No telepon/WhatsApp wajib diisi.');
  if (!toNull(form.addressStreet)) errors.push('Alamat kirim wajib diisi.');
  if (!toNull(form.district)) errors.push('Kecamatan wajib diisi.');
  if (!toNull(form.city)) errors.push('Kota/kabupaten wajib diisi.');
  if (!toNull(form.province)) errors.push('Provinsi wajib diisi.');
  if (!buildStoreLocationDraft(form)) errors.push('Titik lokasi toko wajib direkam.');
  if (form.ktpAvailable && !attachments.ktpPhoto?.uri) errors.push('Foto KTP wajib dilampirkan.');
  if (form.npwpAvailable && !attachments.npwpPhoto?.uri) errors.push('Foto NPWP wajib dilampirkan.');
  if (form.purchaseHistoryAvailable && !attachments.purchaseHistoryPhoto?.uri) {
    errors.push('Foto riwayat pembelian wajib dilampirkan.');
  }
  if (!attachments.storePhoto?.uri) errors.push('Foto toko wajib dilampirkan.');

  return errors;
};

const readDrafts = async () => {
  const raw = await AsyncStorage.getItem(KYC_DRAFT_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const drafts = JSON.parse(raw);
    return Array.isArray(drafts) ? drafts : [];
  } catch (error) {
    return [];
  }
};

const Section = ({ title, children, meta }) => (
  <Surface style={styles.section}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!meta && <Text style={styles.sectionMeta}>{meta}</Text>}
    </View>
    {children}
  </Surface>
);

const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline = false,
}) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && styles.textArea]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textSoft}
      keyboardType={keyboardType}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  </View>
);

const OptionGroup = ({ label, options, value, onChange }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.optionRow}>
      {options.map((item) => {
        const active = item.value === value;

        return (
          <TouchableOpacity
            key={item.value}
            style={[styles.optionButton, active && styles.optionButtonActive]}
            onPress={() => onChange(item.value)}
            activeOpacity={0.88}
          >
            <Text style={[styles.optionText, active && styles.optionTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

const DocumentSwitch = ({ label, value, onValueChange }) => (
  <View style={styles.documentRow}>
    <Text style={styles.documentLabel}>{label}</Text>
    <View style={styles.switchWrap}>
      <Text style={[styles.switchText, !value && styles.switchTextMuted]}>
        {value ? 'Ada' : 'Tidak'}
      </Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primarySoft }}
        thumbColor={value ? colors.primary : '#F8FAFC'}
      />
    </View>
  </View>
);

const AttachmentCapture = ({ label, value, required = false, onCapture, onRemove }) => (
  <View style={styles.attachmentCard}>
    <View style={styles.attachmentTop}>
      <View style={styles.attachmentCopy}>
        <Text style={styles.attachmentLabel}>
          {label}{required ? ' *' : ''}
        </Text>
        <Text style={styles.attachmentMeta} numberOfLines={1}>
          {value?.name || 'Belum ada foto'}
        </Text>
      </View>
      {value?.uri ? (
        <Image source={{ uri: value.uri }} style={styles.attachmentPreview} />
      ) : (
        <View style={styles.attachmentPlaceholder}>
          <Camera size={18} color={colors.textSoft} />
        </View>
      )}
    </View>

    <View style={styles.attachmentActions}>
      <TouchableOpacity style={styles.attachmentButton} onPress={onCapture} activeOpacity={0.88}>
        <Camera size={16} color={colors.primary} />
        <Text style={styles.attachmentButtonText}>
          {value?.uri ? 'Ambil Ulang' : 'Ambil Foto'}
        </Text>
      </TouchableOpacity>
      {value?.uri && (
        <TouchableOpacity style={styles.attachmentRemoveButton} onPress={onRemove} activeOpacity={0.88}>
          <Trash2 size={16} color={colors.danger} />
        </TouchableOpacity>
      )}
    </View>
  </View>
);

const CustomerKycScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const company = useMemo(() => resolveCompanyFromUser(user), [user]);
  const sapPayload = useMemo(() => buildSapPayload(form, company), [form, company]);
  const storeLocation = buildStoreLocationDraft(form);
  const requiredFields = [
    form.customerName,
    form.contactPerson,
    normalizePhoneNumber(form.phone),
    form.addressStreet,
    form.district,
    form.city,
    form.province,
    storeLocation ? 'store_location' : '',
    form.attachments?.storePhoto?.uri,
  ];
  const completedRequired = requiredFields.filter((value) => Boolean(toNull(value))).length;

  const setField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const fillSample = () => {
    setForm(SAMPLE_FORM);
  };

  const setAttachment = (field, value) => {
    setForm((current) => ({
      ...current,
      attachments: {
        ...(current.attachments || {}),
        [field]: value,
      },
    }));
  };

  const captureAttachment = async (field) => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Izin Ditolak', 'Izin kamera diperlukan untuk mengambil attachment KYC.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: false,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert('Gagal', 'Foto attachment tidak ditemukan.');
        return;
      }

      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1400 } }],
        { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG }
      );

      setAttachment(field, {
        uri: manipulated.uri,
        name: `kyc_${field}_${Date.now()}.jpg`,
        type: 'image/jpeg',
        captured_at: new Date().toISOString(),
      });
    } catch (error) {
      console.log('Capture KYC attachment error:', error);
      Alert.alert('Gagal', 'Foto attachment belum bisa diambil.');
    }
  };

  const captureStoreLocation = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert('Izin Ditolak', 'Izin lokasi diperlukan untuk merekam titik toko customer.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const latitude = Number(location?.coords?.latitude);
      const longitude = Number(location?.coords?.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        Alert.alert('Gagal', 'Titik GPS belum terbaca. Pastikan GPS aktif lalu coba lagi.');
        return;
      }

      setField('storeLocation', {
        latitude,
        longitude,
        accuracy: Number.isFinite(Number(location?.coords?.accuracy))
          ? Number(location.coords.accuracy)
          : null,
        recorded_at: new Date(location?.timestamp || Date.now()).toISOString(),
      });
    } catch (error) {
      console.log('Capture KYC store location error:', error);
      Alert.alert('Gagal', 'Titik lokasi toko belum bisa direkam.');
    }
  };

  const saveDraft = async () => {
    const errors = validateForm(form);

    if (errors.length > 0) {
      Alert.alert('Data Belum Lengkap', errors.slice(0, 4).join('\n'));
      return;
    }

    setSaving(true);
    try {
      const drafts = await readDrafts();
      const now = new Date().toISOString();
      const draft = {
        id: `kyc-${Date.now()}`,
        status: 'draft',
        created_at: now,
        customer_name: form.customerName.trim(),
        company: company.sapName,
        branch: {
          id: company.branchId,
          code: company.branchCode,
          name: company.sapName,
          db_sap: company.dbName,
        },
        request_type: form.requestType,
        physical_kyc: {
          ticket_number: toNull(form.ticketNumber),
          sku_number: toNull(form.skuNumber),
          payment_term: 'cash',
          province: toNull(form.province),
          store_location: buildStoreLocationDraft(form),
          documents: {
            ktp_available: form.ktpAvailable,
            npwp_available: form.npwpAvailable,
            purchase_history_available: form.purchaseHistoryAvailable,
          },
        },
        store_location: buildStoreLocationDraft(form),
        attachments: buildAttachmentDraft(form),
        sap_payload: sapPayload,
      };

      await AsyncStorage.setItem(
        KYC_DRAFT_STORAGE_KEY,
        JSON.stringify([draft, ...drafts].slice(0, 50))
      );

      setLastSavedAt(now);
      Alert.alert('Draft Tersimpan', 'Draft KYC customer siap direview.');
    } catch (error) {
      console.log('Save KYC draft error:', error);
      Alert.alert('Gagal', 'Draft KYC belum bisa disimpan di perangkat.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppScreen>
      <PageHeader
        title="Input KYC Customer"
        subtitle="Draft customer baru sebelum dikirim ke SAP."
        eyebrow="Business Partner"
        onBack={() => navigation.goBack()}
        right={(
          <View style={styles.headerIcon}>
            <ClipboardList size={20} color="#fff" />
          </View>
        )}
        variant="hero"
      />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.progressRow}>
            <View style={styles.progressPill}>
              <CheckCircle2 size={16} color={colors.primary} />
              <Text style={styles.progressText}>{completedRequired}/{requiredFields.length} wajib</Text>
            </View>
            <Text style={styles.mappingText}>
              Series {company.series || '-'} | Group {company.groupCode || '-'}
            </Text>
          </View>

          <Section title="Pengajuan" meta={company.sapName}>
            <OptionGroup
              label="Jenis Permohonan"
              options={REQUEST_TYPES}
              value={form.requestType}
              onChange={(value) => setField('requestType', value)}
            />
            <View style={styles.lockedCompany}>
              <Text style={styles.lockedCompanyLabel}>Nama Perusahaan</Text>
              <Text style={styles.lockedCompanyName}>{company.sapName}</Text>
              <Text style={styles.lockedCompanyMeta}>
                DB SAP: {company.dbName || '-'}
              </Text>
            </View>
            <Field
              label="No ID Tiket"
              value={form.ticketNumber}
              onChangeText={(value) => setField('ticketNumber', value)}
              placeholder="Opsional"
            />
            <Field
              label="No SKU"
              value={form.skuNumber}
              onChangeText={(value) => setField('skuNumber', value)}
              placeholder="Opsional untuk perubahan data"
            />
          </Section>

          <Section title="Data Customer">
            <Field
              label="Nama Customer"
              value={form.customerName}
              onChangeText={(value) => setField('customerName', value)}
              placeholder="SUSI AWATI (TB. SUMBER SALUYU)"
            />
            <Field
              label="Nama PIC"
              value={form.contactPerson}
              onChangeText={(value) => setField('contactPerson', value)}
              placeholder="SUSI AWATI"
            />
            <Field
              label="No Telepon / WhatsApp"
              value={form.phone}
              onChangeText={(value) => setField('phone', value)}
              placeholder="+62 813-2245-2712"
              keyboardType="phone-pad"
            />
            <Field
              label="Email"
              value={form.email}
              onChangeText={(value) => setField('email', value)}
              placeholder="Opsional"
              keyboardType="email-address"
            />
          </Section>

          <Section title="Alamat Kirim">
            <Field
              label="Alamat"
              value={form.addressStreet}
              onChangeText={(value) => setField('addressStreet', value)}
              placeholder="JL. CICUKANG NO.39"
            />
            <View style={styles.twoColumn}>
              <Field
                label="RT"
                value={form.rt}
                onChangeText={(value) => setField('rt', value.replace(/[^\d]/g, ''))}
                placeholder="001"
                keyboardType="numeric"
              />
              <Field
                label="RW"
                value={form.rw}
                onChangeText={(value) => setField('rw', value.replace(/[^\d]/g, ''))}
                placeholder="002"
                keyboardType="numeric"
              />
            </View>
            <Field
              label="Kecamatan"
              value={form.district}
              onChangeText={(value) => setField('district', value)}
              placeholder="ARCAMANIK"
            />
            <Field
              label="Kota / Kabupaten"
              value={form.city}
              onChangeText={(value) => {
                setForm((current) => ({
                  ...current,
                  city: value,
                  county: current.county || value,
                }));
              }}
              placeholder="BANDUNG"
            />
            <Field
              label="County SAP"
              value={form.county}
              onChangeText={(value) => setField('county', value)}
              placeholder="BANDUNG"
            />
            <Field
              label="Provinsi"
              value={form.province}
              onChangeText={(value) => setField('province', value)}
              placeholder="JAWA BARAT"
            />
            <Field
              label="Kode Pos"
              value={form.zipCode}
              onChangeText={(value) => setField('zipCode', value.replace(/[^\d]/g, ''))}
              placeholder="Opsional"
              keyboardType="numeric"
            />
          </Section>

          <Section title="Lokasi Toko">
            <View style={styles.locationBox}>
              <View style={styles.locationIcon}>
                <MapPin size={18} color={colors.primary} />
              </View>
              <View style={styles.locationCopy}>
                <Text style={styles.locationTitle}>
                  {storeLocation
                    ? `${storeLocation.latitude.toFixed(6)}, ${storeLocation.longitude.toFixed(6)}`
                    : 'Titik lokasi belum direkam'}
                </Text>
                <Text style={styles.locationMeta}>
                  {storeLocation
                    ? `Akurasi ${storeLocation.accuracy !== null ? `${Math.round(storeLocation.accuracy)}m` : '-'}`
                    : 'Ambil titik saat berada di lokasi toko customer'}
                </Text>
              </View>
            </View>
            <AppButton
              label={storeLocation ? 'Ambil Ulang Titik GPS' : 'Ambil Titik GPS'}
              onPress={captureStoreLocation}
              icon={<MapPin size={17} color="#fff" />}
            />
          </Section>

          <Section title="Dokumen">
            <DocumentSwitch
              label="KTP / ID Card"
              value={form.ktpAvailable}
              onValueChange={(value) => setField('ktpAvailable', value)}
            />
            <DocumentSwitch
              label="NPWP / Tax Card"
              value={form.npwpAvailable}
              onValueChange={(value) => setField('npwpAvailable', value)}
            />
            <DocumentSwitch
              label="Riwayat Pembelian"
              value={form.purchaseHistoryAvailable}
              onValueChange={(value) => setField('purchaseHistoryAvailable', value)}
            />
            <Field
              label="NIK"
              value={form.nik}
              onChangeText={(value) => setField('nik', value.replace(/[^\d]/g, ''))}
              placeholder="Opsional"
              keyboardType="numeric"
            />
            <Field
              label="No NPWP"
              value={form.npwpNumber}
              onChangeText={(value) => setField('npwpNumber', value)}
              placeholder="Opsional"
              keyboardType="numeric"
            />
            <Field
              label="Nama NPWP"
              value={form.npwpName}
              onChangeText={(value) => setField('npwpName', value)}
              placeholder="Opsional"
            />
            <Field
              label="Alamat NPWP"
              value={form.npwpAddress}
              onChangeText={(value) => setField('npwpAddress', value)}
              placeholder="Opsional"
              multiline
            />
          </Section>

          <Section title="Attachment">
            <AttachmentCapture
              label="Foto KTP"
              value={form.attachments?.ktpPhoto}
              required={form.ktpAvailable}
              onCapture={() => captureAttachment('ktpPhoto')}
              onRemove={() => setAttachment('ktpPhoto', null)}
            />
            <AttachmentCapture
              label="Foto NPWP"
              value={form.attachments?.npwpPhoto}
              required={form.npwpAvailable}
              onCapture={() => captureAttachment('npwpPhoto')}
              onRemove={() => setAttachment('npwpPhoto', null)}
            />
            <AttachmentCapture
              label="Foto Riwayat Pembelian"
              value={form.attachments?.purchaseHistoryPhoto}
              required={form.purchaseHistoryAvailable}
              onCapture={() => captureAttachment('purchaseHistoryPhoto')}
              onRemove={() => setAttachment('purchaseHistoryPhoto', null)}
            />
            <AttachmentCapture
              label="Foto Toko"
              value={form.attachments?.storePhoto}
              required
              onCapture={() => captureAttachment('storePhoto')}
              onRemove={() => setAttachment('storePhoto', null)}
            />
          </Section>

          <Section title="Catatan">
            <Field
              label="Catatan Tambahan"
              value={form.notes}
              onChangeText={(value) => setField('notes', value)}
              placeholder="Opsional"
              multiline
            />
            {lastSavedAt && (
              <Text style={styles.savedText}>
                Draft terakhir: {new Date(lastSavedAt).toLocaleString('id-ID')}
              </Text>
            )}
          </Section>

          <View style={styles.footerActions}>
            <AppButton
              label="Isi Contoh"
              onPress={fillSample}
              variant="secondary"
              icon={<ClipboardList size={17} color={colors.primary} />}
            />
            <AppButton
              label="Simpan Draft KYC"
              onPress={saveDraft}
              loading={saving}
              icon={<Save size={17} color="#fff" />}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  progressPill: {
    minHeight: 36,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.soft,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
  },
  mappingText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    textAlign: 'right',
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
  sectionMeta: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    textAlign: 'right',
  },
  field: {
    gap: spacing.sm,
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: spacing.md,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  textArea: {
    minHeight: 96,
    paddingTop: spacing.md,
    lineHeight: 20,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionButton: {
    minHeight: 42,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.textMuted,
  },
  optionTextActive: {
    color: '#FFFFFF',
  },
  lockedCompany: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    gap: 4,
  },
  lockedCompanyLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  lockedCompanyName: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
  lockedCompanyMeta: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
  },
  twoColumn: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  locationBox: {
    minHeight: 64,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  locationIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationCopy: {
    flex: 1,
    gap: 4,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  locationMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  documentRow: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  documentLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  switchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  switchText: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.primary,
  },
  switchTextMuted: {
    color: colors.textMuted,
  },
  attachmentCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
    padding: spacing.md,
    gap: spacing.md,
  },
  attachmentTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  attachmentCopy: {
    flex: 1,
    gap: 4,
  },
  attachmentLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  attachmentMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  attachmentPreview: {
    width: 58,
    height: 58,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
  },
  attachmentPlaceholder: {
    width: 58,
    height: 58,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  attachmentButton: {
    minHeight: 40,
    flex: 1,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  attachmentButtonText: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.primary,
  },
  attachmentRemoveButton: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.success,
  },
  footerActions: {
    gap: spacing.md,
  },
});

export default CustomerKycScreen;
