export const PERMISSIONS = {
  CATALOG_READ: 'catalog.read',
  CATALOG_MANAGE: 'catalog.manage',
  INVENTORY_ADJUST: 'inventory.adjust',
  ORDERS_READ: 'orders.read',
  ORDERS_MANAGE: 'orders.manage',
  ORDER_POLICY_MANAGE: 'orders.policy.manage',
  PAYMENTS_READ: 'payments.read',
  PAYMENTS_MANAGE: 'payments.manage',
  WALLETS_READ: 'wallets.read',
  WALLETS_MANAGE: 'wallets.manage',
  SHIPPING_READ: 'shipping.read',
  SHIPPING_MANAGE: 'shipping.manage',
  SHIPPING_PROVIDER_MANAGE: 'shipping.providers.manage',
  RETURNS_READ: 'returns.read',
  RETURNS_MANAGE: 'returns.manage',
  REFUNDS_READ: 'refunds.read',
  REFUNDS_MANAGE: 'refunds.manage',
  SETTLEMENTS_READ: 'settlements.read',
  SETTLEMENTS_MANAGE: 'settlements.manage',
  RECONCILIATION_READ: 'reconciliation.read',
  RECONCILIATION_MANAGE: 'reconciliation.manage',
  CUSTOMERS_READ: 'customers.read',
  AUDIT_READ: 'audit.read',
  REPORTS_READ: 'reports.read',
  SETTINGS_READ: 'settings.read',
  SETTINGS_MANAGE: 'settings.manage',
  MESSAGING_READ: 'messaging.read',
  MESSAGING_MANAGE: 'messaging.manage',
  CHAT_READ: 'chat.read',
  DELIVERY_ZONES_READ: 'delivery-zones.read',
  DELIVERY_ZONES_MANAGE: 'delivery-zones.manage',
  DELIVERY_PERSONNEL_READ: 'delivery-personnel.read',
  DELIVERY_PERSONNEL_MANAGE: 'delivery-personnel.manage',
  PRODUCT_CONTENT_READ: 'product-content.read',
  PRODUCT_CONTENT_MANAGE: 'product-content.manage',
  PURCHASE_ACTIVITY_READ: 'purchase-activity.read',
  RTO_READ: 'rto.read',
  RTO_MANAGE: 'rto.manage',
  SERVICES_READ: 'services.read',
  SERVICES_MANAGE: 'services.manage',
  STORE_LOCATIONS_READ: 'store-locations.read',
  STORE_LOCATIONS_MANAGE: 'store-locations.manage',
  WARRANTY_READ: 'warranty.read',
  WARRANTY_MANAGE: 'warranty.manage',
  STAFF_READ: 'staff.read',
  STAFF_MANAGE: 'staff.manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL_PERMISSIONS = '*' as const;

export const ROLE_PERMISSION_MATRIX: Readonly<
  Record<string, readonly (Permission | typeof ALL_PERMISSIONS)[]>
> = {
  admin: [ALL_PERMISSIONS],
  user: [],
  delivery_man: [],
};

export function roleHasPermission(
  role: string,
  permission: Permission,
  grantedPermissions: readonly string[] = [],
): boolean {
  const assigned = ROLE_PERMISSION_MATRIX[role] ?? [];
  return (
    assigned.includes(ALL_PERMISSIONS) ||
    assigned.includes(permission) ||
    (role === 'staff' && grantedPermissions.includes(permission))
  );
}
