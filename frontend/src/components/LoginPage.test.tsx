import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api, session } from '../api/client'
import LoginPage from './LoginPage'

afterEach(() => {
  vi.restoreAllMocks()
  session.clear()
})

async function signIn(email: string, password: string) {
  await userEvent.type(screen.getByLabelText(/email/i), email)
  await userEvent.type(screen.getByLabelText(/password/i), password)
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('LoginPage', () => {
  it('saves the token and tells the app who signed in', async () => {
    vi.spyOn(api, 'login').mockResolvedValue({ token: 't0ken', email: 'hr@acme.com' })
    const onSignedIn = vi.fn()
    render(<LoginPage onSignedIn={onSignedIn} />)

    await signIn('hr@acme.com', 'secret')

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith('hr@acme.com'))
    expect(session.token()).toBe('t0ken')
  })

  it('shows the server message when the password is wrong and stays signed out', async () => {
    vi.spyOn(api, 'login').mockRejectedValue(new Error('Incorrect email or password'))
    const onSignedIn = vi.fn()
    render(<LoginPage onSignedIn={onSignedIn} />)

    await signIn('hr@acme.com', 'nope')

    expect(await screen.findByText('Incorrect email or password')).toBeInTheDocument()
    expect(onSignedIn).not.toHaveBeenCalled()
    expect(session.token()).toBeNull()
  })

  it('does not call the API when the fields are empty', async () => {
    const login = vi.spyOn(api, 'login')
    render(<LoginPage onSignedIn={() => {}} />)

    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(login).not.toHaveBeenCalled()
  })
})
