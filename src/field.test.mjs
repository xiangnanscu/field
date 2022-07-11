import { string, sfzh, integer } from './field.mjs'


const s1 = string.new({ maxlength: 5, minlength: 2, name: 's1', required: true })
test('必填空字符串', () => {
  expect(() => s1.validate("")).toThrow('此项必填');
});
test('必填null', () => {
  expect(() => s1.validate(null)).toThrow('此项必填');
});
test('必填undefined', () => {
  expect(() => s1.validate(undefined)).toThrow('此项必填');
});
test('最小长度', () => {
  expect(() => s1.validate("1")).toThrow(`字数不能少于${s1.minlength}个`);
});
test('最大长度', () => {
  expect(() => s1.validate("123456")).toThrow(`字数不能多于${s1.maxlength}个`);
});
test('去空格', () => {
  expect(s1.validate("1 2 3")).toBe('123')
});

const sfz1 = sfzh.new({ name: 'sfz1', required: true })
try {
  sfz1.validate("12")

} catch (error) {

}

const i1 = integer.new({ name: 'i1', min: 1, max: 3 })
try {
  i1.validate(0)

} catch (error) {

}
try {
  i1.validate(4)

} catch (error) {

}
i1.validate(2)
console.log("test passed")