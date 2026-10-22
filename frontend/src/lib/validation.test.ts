import { type EmployeeFormValues, toInput, validateEmployee } from './validation'

const TODAY = new Date('2026-06-15')

const valid: EmployeeFormValues = {
  full_name: 'Asha Rao',
  email: 'asha@acme.com',
  job_title: 'Software Engineer',
  department: 'Engineering',
  country: 'IN',
  salary: '2400000',
  hire_date: '2022-03-14',
}

describe('validateEmployee', () => {
  it('accepts a complete, valid form', () => {
    expect(validateEmployee(valid, TODAY)).toEqual({})
  })

  it('requires every text field', () => {
    const errors = validateEmployee(
      { ...valid, full_name: ' ', job_title: '', department: '', country: '', hire_date: '' },
      TODAY,
    )
    expect(Object.keys(errors).sort()).toEqual(['country', 'department', 'full_name', 'hire_date', 'job_title'])
  })

  it.each(['abc', '0', '-5', '12.5', ''])('rejects salary %j', (salary) => {
    expect(validateEmployee({ ...valid, salary }, TODAY).salary).toBeDefined()
  })

  it('rejects malformed email', () => {
    expect(validateEmployee({ ...valid, email: 'nope' }, TODAY).email).toBeDefined()
  })

  it('rejects a hire date in the future but allows today', () => {
    expect(validateEmployee({ ...valid, hire_date: '2026-06-16' }, TODAY).hire_date).toBeDefined()
    expect(validateEmployee({ ...valid, hire_date: '2026-06-15' }, TODAY).hire_date).toBeUndefined()
  })
})

describe('toInput', () => {
  it('trims text and converts salary to a number', () => {
    expect(toInput({ ...valid, full_name: '  Asha Rao ', salary: '2400000' })).toMatchObject({
      full_name: 'Asha Rao',
      salary: 2400000,
    })
  })
})
