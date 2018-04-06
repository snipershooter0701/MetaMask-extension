const assert = require('assert')
const clone = require('clone')
const Migrator = require('../../app/scripts/lib/migrator/')
const liveMigrations = require('../../app/scripts/migrations/')
const stubMigrations = [
  {
    version: 1,
    migrate: (data) => {
      // clone the data just like we do in migrations
      const clonedData = clone(data)
      clonedData.meta.version = 1
      return Promise.resolve(clonedData)
    },
  },
  {
    version: 2,
    migrate: (data) => {
      const clonedData = clone(data)
      clonedData.meta.version = 2
      return Promise.resolve(clonedData)
    },
  },
  {
    version: 3,
    migrate: (data) => {
      const clonedData = clone(data)
      clonedData.meta.version = 3
      return Promise.resolve(clonedData)
    },
  },
]
const versionedData = {meta: {version: 0}, data: {hello: 'world'}}

const firstTimeState = {
  meta: { version: 0 },
  data: require('../../app/scripts/first-time-state'),
}

describe.only('Migrator', () => {
  const migrator = new Migrator({ migrations: stubMigrations })
  it('migratedData version should be version 3', (done) => {
    migrator.on('error', console.log)
    migrator.migrateData(versionedData)
    .then((migratedData) => {
      assert.equal(migratedData.meta.version, stubMigrations[2].version)
      done()
    }).catch(done)
  })

  it('should match the last version in live migrations', (done) => {
    const migrator = new Migrator({ migrations: liveMigrations })
    migrator.on('error', console.log)
    migrator.migrateData(firstTimeState)
    .then((migratedData) => {
    console.log(migratedData)
      const last = liveMigrations.length - 1
      assert.equal(migratedData.meta.version, liveMigrations[last].version)
      done()
    }).catch(done)
  })

})
