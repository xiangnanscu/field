import { string, sfzh, integer } from './field.mjs'


const s1 = string.new({ maxlength: 5, minlength: 2, name: 's1', required: true })
try {
  s1.validate("")

} catch (error) {
  if (error.message !== s1.errorMessages.required) {
    throw "should raise required error"
  }
}
try {
  s1.validate("1")

} catch (error) {

}
try {
  s1.validate('12')

} catch (error) {

}

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