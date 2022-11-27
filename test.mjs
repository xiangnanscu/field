/* eslint-disable no-undef */
import { string, sfzh, integer, datetime, date, array } from "./src/field.mjs";

const s1 = string.new({
  maxlength: 5,
  minlength: 2,
  name: "s1",
  required: true,
});
test("string.json()", () => {
  expect(s1.json()).toEqual({
    name: "s1",
    type: "string",
    dbType: "varchar",
    required: true,
    label: "s1",
    default: "",
    null: false,
    compact: true,
    trim: true,
    minlength: 2,
    maxlength: 5,
    tag: "input",
    lazy: true,
  });
});
test("必填空字符串", () => {
  expect(() => s1.validate("")).toThrow("此项必填");
});
test("必填null", () => {
  expect(() => s1.validate(null)).toThrow();
});
test("必填undefined", () => {
  expect(() => s1.validate(undefined)).toThrow("此项必填");
});
test("最小长度", () => {
  expect(() => s1.validate("1")).toThrow(`字数不能少于${s1.minlength}个`);
});
test("最大长度", () => {
  expect(() => s1.validate("123456")).toThrow(`字数不能多于${s1.maxlength}个`);
});
test("去空格", () => {
  expect(s1.validate("1 2 ")).toBe("12");
});

const sfz1 = sfzh.new({ name: "sfz1", required: true });
// console.log(sfz1.finalValidators)
test("sfzh.json()", () => {
  expect(sfz1.json()).toEqual({
    name: "sfz1",
    type: "sfzh",
    dbType: "varchar",
    required: true,
    label: "sfz1",
    default: "",
    null: false,
    compact: true,
    trim: true,
    length: 18,
    tag: "input",
    lazy: true,
  });
});
test("合法身份证", () => {
  expect(sfz1.validate("340202197104106891")).toBe("340202197104106891");
});
test("非法身份证号-少一位", () => {
  expect(() => sfz1.validate("34020219710410689")).toThrow(
    `字数需等于${sfz1.length}个`
  );
});
test("非法身份证号-多一位", () => {
  expect(() => sfz1.validate("3402021971041068911")).toThrow(
    `字数需等于${sfz1.length}个`
  );
});
test("非法身份证号", () => {
  expect(() => sfz1.validate("340202197104106892")).toThrow("身份证号错误");
});
test("非法身份证号-年份", () => {
  expect(() => sfz1.validate("340202297104106891")).toThrow("身份证号错误");
});

const i1 = integer.new({ name: "i1", min: 1, max: 3 });
// console.log(i1.json())
test("integer.json()", () => {
  expect(i1.json()).toEqual({
    name: "i1",
    type: "integer",
    dbType: "integer",
    required: false,
    label: "i1",
    null: true,
    min: 1,
    max: 3,
    tag: "input",
    lazy: true,
  });
});
test("合法整数", () => {
  expect(i1.validate(2)).toBe(2);
});
test("合法整数", () => {
  expect(i1.validate("2")).toBe(2);
});
test("整数太大", () => {
  expect(() => i1.validate(4)).toThrow(`值不能大于${i1.max}`);
});
test("整数太小", () => {
  expect(() => i1.validate(0)).toThrow(`值不能小于${i1.min}`);
});
test("不能是浮点数", () => {
  expect(() => i1.validate(1.12)).toThrow(`要求整数`);
});
test("不能是浮点字符串", () => {
  expect(() => i1.validate("1.1")).toThrow(`要求整数`);
});

const d1 = datetime.new({ autoNowAdd: true, name: "d1" });
// console.log(d1.json())
test("datetime.json()", () => {
  expect(d1.json()).toEqual({
    name: "d1",
    type: "datetime",
    dbType: "timestamp",
    disabled: true,
    required: false,
    label: "d1",
    null: true,
    autoNowAdd: true,
    precision: 0,
    timezone: true,
    tag: "input",
    lazy: true,
  });
});
test("合法datetime", () => {
  expect(d1.validate("2010-01-01 00:00:00")).toBe("2010-01-01 00:00:00");
});
test("非法datetime格式", () => {
  expect(() => d1.validate("210-21-01 00:00:00")).toThrow(/^日期格式错误/);
});
test("非法datetime月份", () => {
  expect(() => d1.validate("2010-21-01 00:00:00")).toThrow(/月份数字\d+错误/);
});
test("非法datetime日期", () => {
  expect(() => d1.validate("2010-01-41 00:00:00")).toThrow(/日期数字\d+错误/);
});
test("非法datetime时", () => {
  expect(() => d1.validate("2010-01-01 70:00:00")).toThrow(/小时数字\d+错误/);
});
test("非法datetime分", () => {
  expect(() => d1.validate("2010-01-01 00:70:00")).toThrow(/分钟数字\d+错误/);
});
test("非法datetime秒", () => {
  expect(() => d1.validate("2010-01-01 00:00:70")).toThrow(/秒数字\d+错误/);
});

const d2 = date.new({ name: "d2" });
// console.log(d2.json())
test("date.json()", () => {
  expect(d2.json()).toEqual({
    name: "d2",
    type: "date",
    dbType: "date",
    required: false,
    label: "d2",
    null: true,
    tag: "input",
    lazy: true,
  });
});
test("合法date", () => {
  expect(d2.validate("2010-01-01")).toBe("2010-01-01");
});
test("非法date格式", () => {
  expect(() => d2.validate("210-21-01")).toThrow(/^日期格式错误/);
});
test("非法date月份", () => {
  expect(() => d2.validate("2010-21-01")).toThrow(/月份数字\d+错误/);
});
test("非法date日期", () => {
  expect(() => d2.validate("2010-01-41")).toThrow(/日期数字\d+错误/);
});

const a1 = array.new({ name: "a1" });
test("数组不能为数字", () => {
  expect(() => a1.validate(1)).toThrow(/value of array field must be a array/);
});
test("数组跳过字符串类型", () => {
  expect(a1.validate("[]")).toBe("[]");
});
