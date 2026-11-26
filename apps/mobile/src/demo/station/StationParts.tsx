import {
  StationList as ProductStationList,
  Times as ProductTimes,
} from '../../components/station/StationParts.tsx';
import { type Eta, type Roster, type StationId, STATIONS } from './stationModel.ts';

export {
  Chip,
  FlagLine,
  FlaggedCount,
  GLYPH,
  Quiet,
  Segments,
} from '../../components/station/StationParts.tsx';

export function Times({
  item,
  chosen,
  side,
  onPick,
}: {
  item: string;
  chosen: Eta | undefined;
  side: number;
  onPick: (eta: Eta) => void;
}) {
  return <ProductTimes item={item} id={item} chosen={chosen} side={side} onPick={onPick} />;
}

export function StationList({
  current,
  you,
  roster,
  side,
  onPick,
}: {
  current: StationId | null;
  you: string;
  roster: Roster;
  side: number;
  onPick: (id: StationId) => void;
}) {
  const stations = STATIONS.map((st) => {
    const who = roster[st.id].map((n) => (n === you ? `${n} · you` : n));
    return { id: st.id, name: st.name, people: who.length === 0 ? null : who.join(', ') };
  });
  return (
    <ProductStationList
      current={current}
      stations={stations}
      side={side}
      onPick={(id) => onPick(id as StationId)}
    />
  );
}
