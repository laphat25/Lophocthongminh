from fastapi.responses import JSONResponse
from app.logger import logger

class AppError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)

class NotFoundError(AppError):
    def __init__(self, detail: str = "Không tìm thấy tài nguyên"):
        super().__init__(404, detail)

class ForbiddenError(AppError):
    def __init__(self, detail: str = "Không có quyền truy cập hoặc thực hiện hành động này"):
        super().__init__(403, detail)

class ValidationError(AppError):
    def __init__(self, detail: str = "Dữ liệu yêu cầu không hợp lệ"):
        super().__init__(400, detail)

class UnauthorizedError(AppError):
    def __init__(self, detail: str = "Thông tin xác thực không chính xác hoặc đã hết hạn"):
        super().__init__(401, detail)
