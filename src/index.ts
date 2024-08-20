import { Query } from 'database';
import {
  checkPrimaryKey,
  checkUniqueKey,
  createRow,
  deleteRow,
  findByPrimaryKey,
  updateRow,
} from 'database-helpers';
import { Debug, MessageType } from 'node-debug';
import { objectsEqual, pick } from 'node-utilities';

const debugSource = 'table.service';
const debugRows = 3;

const tableName = '_tables';
const instanceName = 'table';

export type PrimaryKey = {
  table_uuid: string;
};

export type Data = {
  table_name: string;
  instance_name: string;
  is_enabled?: boolean;
};

export const dataColumnNames = ['table_name', 'instance_name', 'is_enabled'];

export type CreateData = PrimaryKey & Data;
export type Row = PrimaryKey & Required<Data>;
export type UpdateData = Partial<Data>;

export const create = async (query: Query, createData: CreateData) => {
  const debug = new Debug(`${debugSource}.create`);
  debug.write(MessageType.Entry, `createData=${JSON.stringify(createData)}`);
  const primaryKey: PrimaryKey = { table_uuid: createData.table_uuid };
  debug.write(MessageType.Value, `primaryKey=${JSON.stringify(primaryKey)}`);
  debug.write(MessageType.Step, 'Checking primary key...');
  await checkPrimaryKey(query, tableName, instanceName, primaryKey);
  debug.write(MessageType.Step, 'Validating data...');
  const uniqueKey1 = { table_name: createData.table_name };
  debug.write(MessageType.Value, `uniqueKey1=${JSON.stringify(uniqueKey1)}`);
  debug.write(MessageType.Step, 'Checking unique key 1...');
  await checkUniqueKey(query, tableName, instanceName, uniqueKey1);
  const uniqueKey2 = { instance_name: createData.instance_name };
  debug.write(MessageType.Value, `uniqueKey2=${JSON.stringify(uniqueKey2)}`);
  debug.write(MessageType.Step, 'Checking unique key 2...');
  await checkUniqueKey(query, tableName, instanceName, uniqueKey2);
  debug.write(MessageType.Step, 'Creating data table (and sequence)...');
  const text =
    `CREATE TABLE ${createData.table_name} (` +
    'id serial, ' +
    'creation_date timestamptz NOT NULL DEFAULT now(), ' +
    'created_by uuid NOT NULL DEFAULT uuid_nil(), ' +
    'last_update_date timestamptz NOT NULL DEFAULT now(), ' +
    'last_updated_by uuid NOT NULL DEFAULT uuid_nil(), ' +
    'file_count smallint NOT NULL DEFAULT 0, ' +
    `CONSTRAINT "${createData.table_uuid}_pk" PRIMARY KEY (id)` +
    ')';
  debug.write(MessageType.Value, `text=(${text})`);
  await query(text);
  debug.write(MessageType.Step, 'Creating row...');
  const createdRow = (await createRow(query, tableName, createData)) as Row;
  debug.write(MessageType.Exit, `createdRow=${JSON.stringify(createdRow)}`);
  return createdRow;
};

// TODO: query parameters + add actual query to helpers
export const find = async (query: Query) => {
  const debug = new Debug(`${debugSource}.find`);
  debug.write(MessageType.Entry);
  debug.write(MessageType.Step, 'Finding rows...');
  const rows = (await query(`SELECT * FROM ${tableName} ORDER BY table_uuid`))
    .rows as Row[];
  debug.write(
    MessageType.Exit,
    `rows(${debugRows})=${JSON.stringify(rows.slice(0, debugRows))}`,
  );
  return rows;
};

export const findOne = async (query: Query, primaryKey: PrimaryKey) => {
  const debug = new Debug(`${debugSource}.findOne`);
  debug.write(MessageType.Entry, `primaryKey=${JSON.stringify(primaryKey)}`);
  debug.write(MessageType.Step, 'Finding row by primary key...');
  const row = (await findByPrimaryKey(
    query,
    tableName,
    instanceName,
    primaryKey,
  )) as Row;
  debug.write(MessageType.Exit, `row=${JSON.stringify(row)}`);
  return row;
};

export const update = async (
  query: Query,
  primaryKey: PrimaryKey,
  updateData: UpdateData,
) => {
  const debug = new Debug(`${debugSource}.update`);
  debug.write(
    MessageType.Entry,
    `primaryKey=${JSON.stringify(primaryKey)};updateData=${JSON.stringify(updateData)}`,
  );
  debug.write(MessageType.Step, 'Finding row by primary key...');
  const row = (await findByPrimaryKey(
    query,
    tableName,
    instanceName,
    primaryKey,
    true,
  )) as Row;
  debug.write(MessageType.Value, `row=${JSON.stringify(row)}`);
  const mergedRow: Row = Object.assign({}, row, updateData);
  let updatedRow: Row = Object.assign({}, mergedRow);
  if (
    !objectsEqual(pick(mergedRow, dataColumnNames), pick(row, dataColumnNames))
  ) {
    debug.write(MessageType.Step, 'Validating data...');
    if (
      typeof updateData.table_name !== 'undefined' &&
      updateData.table_name !== row.table_name
    ) {
      const uniqueKey1 = { table_name: updateData.table_name };
      debug.write(
        MessageType.Value,
        `uniqueKey1=${JSON.stringify(uniqueKey1)}`,
      );
      debug.write(MessageType.Step, 'Checking unique key 1...');
      await checkUniqueKey(query, tableName, instanceName, uniqueKey1);
    }
    if (
      typeof updateData.instance_name !== 'undefined' &&
      updateData.instance_name !== row.instance_name
    ) {
      const uniqueKey2 = { instance_name: updateData.instance_name };
      debug.write(
        MessageType.Value,
        `uniqueKey1=${JSON.stringify(uniqueKey2)}`,
      );
      debug.write(MessageType.Step, 'Checking unique key 2...');
      await checkUniqueKey(query, tableName, instanceName, uniqueKey2);
    }
    if (
      typeof updateData.table_name !== 'undefined' &&
      updateData.table_name !== row.table_name
    ) {
      debug.write(MessageType.Step, 'Renaming data table...');
      let text = `ALTER TABLE ${row.table_name} RENAME TO ${updateData.table_name}`;
      debug.write(MessageType.Value, `text=(${text})`);
      await query(text);
      debug.write(MessageType.Step, 'Renaming data table sequence...');
      text = `ALTER SEQUENCE ${row.table_name}_id_seq RENAME TO ${updateData.table_name}_id_seq`;
      debug.write(MessageType.Value, `text=(${text})`);
      await query(text);
    }
    debug.write(MessageType.Step, 'Updating row...');
    updatedRow = (await updateRow(
      query,
      tableName,
      primaryKey,
      updateData,
    )) as Row;
  }
  debug.write(MessageType.Exit, `updatedRow=${JSON.stringify(updatedRow)}`);
  return updatedRow;
};

export const delete_ = async (query: Query, primaryKey: PrimaryKey) => {
  const debug = new Debug(`${debugSource}.delete`);
  debug.write(MessageType.Entry, `primaryKey=${JSON.stringify(primaryKey)}`);
  debug.write(MessageType.Step, 'Finding row by primary key...');
  const row = (await findByPrimaryKey(
    query,
    tableName,
    instanceName,
    primaryKey,
    true,
  )) as Row;
  debug.write(MessageType.Value, `row=${JSON.stringify(row)}`);
  debug.write(MessageType.Step, 'Dropping data table (and sequence)...');
  const text = `DROP TABLE ${row.table_name}`;
  debug.write(MessageType.Value, `text=(${text})`);
  await query(text);
  debug.write(MessageType.Step, 'Deleting row...');
  await deleteRow(query, tableName, primaryKey);
  debug.write(MessageType.Exit);
};
