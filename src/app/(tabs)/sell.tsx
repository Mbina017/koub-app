// Staff outside (API 1.40): "New order" is the till, as a tab next to "My orders".
import { Redirect } from 'expo-router';
import { useSession } from '../../lib/session';
import { RolePicker } from '../../components/Staff';
import Pos from '../pos';

export default function Sell() {
  const { cashier, staffRole } = useSession();
  if (cashier && !staffRole) return <RolePicker />;
  if (!cashier || staffRole === 'inside') return <Redirect href={'/work' as never} />;
  return <Pos inTab />;
}
