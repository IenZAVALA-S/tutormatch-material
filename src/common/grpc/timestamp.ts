export interface TimestampGrpc {
  seconds: number;
  nanos: number;
}

export function aTimestamp(fecha: Date): TimestampGrpc {
  const ms = fecha.getTime();
  return {
    seconds: Math.floor(ms / 1000),
    nanos: (ms % 1000) * 1_000_000,
  };
}
