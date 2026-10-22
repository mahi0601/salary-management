import { type EmployeeFormValues, type RaiseFormValues, toInput, validateEmployee, validateRaise } from './validation'

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

describe('validateRaise', () => {
  const raise: RaiseFormValues = { salary: '110000', effective_date: '2025-01-01', reason: 'Promotion' }

  it('accepts a complete change', () => {
    expect(validateRaise(raise, '2022-03-14', TODAY)).toEqual({})
  })

  it.each(['', '0', '-1', '1.5', 'abc'])('rejects salary %j', (salary) => {
    expect(validateRaise({ ...raise, salary }, '2022-03-14', TODAY).salary).toBeDefined()
  })

  it('rejects a date before the hire date but allows the hire date itself', () => {
    expect(validateRaise({ ...raise, effective_date: '2022-03-13' }, '2022-03-14', TODAY).effective_date).toBeDefined()
    expect(validateRaise({ ...raise, effective_date: '2022-03-14' }, '2022-03-14', TODAY).effective_date).toBeUndefined()
  })

  it('rejects a future date', () => {
    expect(validateRaise({ ...raise, effective_date: '2026-06-16' }, '2022-03-14', TODAY).effective_date).toBeDefined()
  })

  it('requires a reason', () => {
    expect(validateRaise({ ...raise, reason: '  ' }, '2022-03-14', TODAY).reason).toBeDefined()
  })
})
