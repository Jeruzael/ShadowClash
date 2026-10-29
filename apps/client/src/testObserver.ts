import type { Snapshot } from '@shadow-clash/shared';
import type { Socket } from 'socket.io-client';

export interface ClientTestObserver { socket: Socket; history: Snapshot[] }
declare global { interface Window { __SC_TEST__?: ClientTestObserver } }
