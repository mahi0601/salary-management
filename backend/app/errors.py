class DomainError(Exception):
    status_code = 400

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class EmployeeNotFound(DomainError):
    status_code = 404

    def __init__(self, employee_id: int):
        super().__init__(f"Employee {employee_id} not found")


class DuplicateEmail(DomainError):
    status_code = 409

    def __init__(self, email: str):
        super().__init__(f"An employee with email {email} already exists")
