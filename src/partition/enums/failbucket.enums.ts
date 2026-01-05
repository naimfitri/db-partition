export enum PartitionFailureStatus {
  PENDING = 'PENDING',
  RETRYING = 'RETRYING',
  RESOLVED = 'RESOLVED',
  DEAD = 'DEAD',
}

export enum PartitionFailureAction {
  DROP = 'DROP',
  TRUNCATE = 'TRUNCATE',
  CREATE = 'CREATE',
}