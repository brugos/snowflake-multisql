import { expect, assert } from "chai";
import sinon from "sinon";

import {
  SnowflakeMultiSql as Snowflake,
  ITag,
} from "../src/snowflake-multisql";

describe("test1", () => {
  it("test", () => expect(true).to.be.true);
});

describe("checks tagsToBinds function", () => {
  let snowflake: Snowflake;

  const sqlText: string =
    "select * from {%inline1%} {%tag0%} {%tag2%} {%tag0%} {%tag4%} where {%tag2%} {%tag4%}";
  const tags: ITag[] = [
    { tag: "tag0", value: "hi" },
    { tag: "tag2", value: 123 },
    { tag: "tag4", value: new Date(1610976670682) },
    { tag: "inline1", value: "tblName", inline: true },
  ];
  type Conversion = {
    ID: string;
    NUM: number;
    DATE: Date;
    OBJ?: any;
  };
  const mockedResponse: any[] = [
    {
      ID: "ID",
      NUM: 123,
      DATE: new Date(),
      OBJ: { a: "a", b: 1, c: new Date() },
    },
  ];

  beforeEach(() => {
    snowflake = new Snowflake({
      account: "<account name>",
      username: "<username>",
      password: "<password>",
      database: "DEMO_DATABASE",
      schema: "DEMO_SCHEMA",
      warehouse: "DEMO_WH",
    });
    const stubSF = sinon.stub(snowflake, "execute");
    stubSF.resolves(mockedResponse);
  });

  afterEach(() => {
    sinon.restore();
  });

  it("executeAll with Generics", async () => {
    const ret = await snowflake.executeAll<Conversion>({
      sqlText,
      tags,
      includeResults: true,
    });
    expect(ret[0].data).to.deep.equal(mockedResponse);
  });
  it("executeAll must emmit progress event at least once", async () => {
    const spyProgress = sinon.spy();
    snowflake.progress.on("news", spyProgress);

    const ret = await snowflake.executeAll({
      sqlText,
      tags,
      preview: true,
    });
    expect(spyProgress.called).to.be.true;
  });

  it("check binds functionality", async () => {
    const expected = {
      chunkText: "select * from tblName :1 :2 :3 :4 where :5 :6",
      chunkOrder: 1,
      chunksTotal: 1,
      binds: [
        "hi",
        123,
        "hi",
        new Date(1610976670682),
        123,
        new Date(1610976670682),
      ],
    };
    const ret = await snowflake.executeAll({
      sqlText,
      tags,
      includeResults: false,
    });
    expect(ret[0]).to.containSubset(expected);
  });

  it("check tags absence", async () => {
    const sqlText = "select * from tableName";
    const expected = {
      chunkText: sqlText,
      chunkOrder: 1,
      chunksTotal: 1,
      binds: [],
    };
    const ret = await snowflake.executeAll({
      sqlText,
    });
    expect(ret[0]).to.containSubset(expected);
  });

  it("no tags sqltext, no tags params", () => {
    const sqlText = "select * from table";
    const ret = snowflake.tagsToBinds(sqlText);
    expect(ret.sqlText).to.eql("select * from table");
    expect(ret.binds).to.eql([]);
  });

  it("no tags on sqltext, tags on params", () => {
    const sqlText = "select * from table";
    const ret = snowflake.tagsToBinds(sqlText, [{ tag: "tag1", value: 1 }]);
    expect(ret.sqlText).to.eql("select * from table");
    expect(ret.binds).to.eql([]);
  });

  it("tags on sqltext, no tags on params", () => {
    const sqlText = "select * from table {%tag1%}";
    try {
      snowflake.tagsToBinds(sqlText, []);
    } catch (error) {
      assert.equal(error.message, "###");
    }
  });

  it("less tag params then tags on sqltext", () => {
    const sqlText = "select * from table {%tag1%} {%tag2%}";
    const tags: ITag[] = [{ tag: "tag1", value: "tag1value" }];
    try {
      snowflake.tagsToBinds(sqlText, tags);
    } catch (error) {
      assert.equal(error.message, "###");
    }
  });
});
