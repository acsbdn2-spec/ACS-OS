export type Lang = 'en' | 'bn'

const dict = {
  en: {
    // Nav
    home: 'Home', catalog: 'Catalog', serials: 'Serials', customers: 'Customers',
    service: 'Service', quotes: 'Quotes', tenders: 'Tenders', reports: 'Reports',
    settings: 'Settings',
    // Catalog
    products: 'Products', addProduct: 'Add Product', editProduct: 'Edit Product',
    search: 'Search products…', stock: 'Stock', price: 'Price', category: 'Category',
    noStock: 'Out of Stock', lowStock: 'Low Stock', inStock: 'In Stock',
    cost: 'Cost', floor: 'Floor', sell: 'Sell Price', gst: 'GST',
    duplicateWarning: 'A similar product already exists',
    // Serials
    serialNo: 'Serial No.', warranty: 'Warranty', inWarranty: 'In Warranty',
    expired: 'Expired', available: 'Available', sold: 'Sold', rma: 'RMA',
    // Auth
    login: 'Login', logout: 'Logout', email: 'Email', password: 'Password',
    loginWithBiometric: 'Login with Fingerprint / Face ID',
    // Common
    save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', view: 'View',
    confirm: 'Confirm', loading: 'Loading…', error: 'Error', success: 'Done',
    noData: 'No data', refresh: 'Refresh', export: 'Export', print: 'Print',
    syncedAt: 'Stock last synced', never: 'Never',
    // Roles
    owner: 'Owner', staff: 'Staff', viewer: 'Viewer', technician: 'Technician',
    // Job cards
    jobCard: 'Job Card', newJob: 'New Job', complaint: 'Complaint',
    device: 'Device', assignTo: 'Assign to', estimate: 'Estimate',
    // Sessions
    activeSessions: 'Active Sessions', forceLogout: 'Force Logout',
    thisDevice: 'This device',
  },
  bn: {
    home: 'হোম', catalog: 'ক্যাটালগ', serials: 'সিরিয়াল', customers: 'গ্রাহক',
    service: 'সার্ভিস', quotes: 'কোটেশন', tenders: 'টেন্ডার', reports: 'রিপোর্ট',
    settings: 'সেটিংস',
    products: 'পণ্য', addProduct: 'পণ্য যোগ করুন', editProduct: 'পণ্য সম্পাদনা',
    search: 'পণ্য খুঁজুন…', stock: 'স্টক', price: 'মূল্য', category: 'ক্যাটাগরি',
    noStock: 'স্টক নেই', lowStock: 'কম স্টক', inStock: 'স্টক আছে',
    cost: 'ক্রয় মূল্য', floor: 'ফ্লোর', sell: 'বিক্রয় মূল্য', gst: 'জিএসটি',
    duplicateWarning: 'একই রকম পণ্য ইতিমধ্যে আছে',
    serialNo: 'সিরিয়াল নম্বর', warranty: 'ওয়ারেন্টি', inWarranty: 'ওয়ারেন্টিতে',
    expired: 'মেয়াদ শেষ', available: 'উপলব্ধ', sold: 'বিক্রি', rma: 'আরএমএ',
    login: 'লগইন', logout: 'লগআউট', email: 'ইমেইল', password: 'পাসওয়ার্ড',
    loginWithBiometric: 'ফিঙ্গারপ্রিন্ট / ফেস আইডি দিয়ে লগইন',
    save: 'সংরক্ষণ', cancel: 'বাতিল', delete: 'মুছুন', edit: 'সম্পাদনা',
    view: 'দেখুন', confirm: 'নিশ্চিত করুন', loading: 'লোড হচ্ছে…',
    error: 'ত্রুটি', success: 'সম্পন্ন', noData: 'কোনো তথ্য নেই',
    refresh: 'রিফ্রেশ', export: 'এক্সপোর্ট', print: 'প্রিন্ট',
    syncedAt: 'শেষ সিঙ্ক', never: 'কখনো না',
    owner: 'মালিক', staff: 'কর্মী', viewer: 'দর্শক', technician: 'টেকনিশিয়ান',
    jobCard: 'জব কার্ড', newJob: 'নতুন জব', complaint: 'অভিযোগ',
    device: 'ডিভাইস', assignTo: 'নিয়োগ', estimate: 'আনুমানিক',
    activeSessions: 'সক্রিয় সেশন', forceLogout: 'জোর লগআউট', thisDevice: 'এই ডিভাইস',
  },
}

type Keys = keyof (typeof dict)['en']

export function t(key: Keys, lang: Lang = 'en'): string {
  return (dict[lang] as Record<Keys, string>)[key] ?? dict['en'][key] ?? key
}

export function useLang(): Lang {
  // Client-side: read from localStorage or default 'en'
  if (typeof window === 'undefined') return 'en'
  return (localStorage.getItem('lang') as Lang) || 'en'
}
