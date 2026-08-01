export type AppRole = 'owner' | 'dispatcher' | 'technician' | 'office';

export function isOfficeRole(role: AppRole) {
  return role === 'owner' || role === 'dispatcher' || role === 'office';
}

export function homeForRole(role: AppRole) {
  return isOfficeRole(role) ? '/dashboard' : '/tech';
}

export function roleLabel(role: AppRole) {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'dispatcher':
      return 'Dispatcher';
    case 'office':
      return 'Office';
    case 'technician':
      return 'Technician';
  }
}
