import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.js';
import { db } from '../db/index.js';
import { Trip, TripMember, UserRole } from '../types/shared.js';

export interface TripRequest extends AuthenticatedRequest {
  trip?: Trip;
  tripMember?: TripMember;
  tripRole?: UserRole;
}

export function requireTripMember(req: TripRequest, res: Response, next: NextFunction): void {
  const tripId = req.params.tripId || req.params.id;
  const userId = req.user?.id;

  if (!tripId || !userId) {
    res.status(400).json({ error: 'Missing tripId or user identifier.' });
    return;
  }

  const tripStmt = db.prepare('SELECT * FROM trips WHERE id = ? AND deleted_at IS NULL');
  const trip = tripStmt.get(tripId) as Trip | undefined;

  if (!trip) {
    res.status(404).json({ error: 'Trip not found.' });
    return;
  }

  const memberStmt = db.prepare(
    'SELECT * FROM trip_members WHERE trip_id = ? AND user_id = ? AND status = ?'
  );
  const member = memberStmt.get(tripId, userId, 'ACTIVE') as TripMember | undefined;

  if (!member) {
    res.status(403).json({ error: 'Forbidden: You are not an active member of this private trip room.' });
    return;
  }

  req.trip = trip;
  req.tripMember = member;
  req.tripRole = member.role;
  next();
}

export function requireTripOwner(req: TripRequest, res: Response, next: NextFunction): void {
  requireTripMember(req, res, () => {
    if (req.tripRole !== 'OWNER') {
      res.status(403).json({ error: 'Forbidden: Only the Trip Owner has permission to perform this action.' });
      return;
    }
    next();
  });
}
