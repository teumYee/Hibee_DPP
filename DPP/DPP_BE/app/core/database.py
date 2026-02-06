import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# 1. .env 파일 로드
load_dotenv()

# 2. DB 주소 가져오기
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

# (안전장치) URL이 없으면 에러 발생
if not SQLALCHEMY_DATABASE_URL:
    raise ValueError("DATABASE_URL이 없습니다. .env 파일을 확인해주세요!")

# 3. 엔진 생성
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# 4. 세션 생성기
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 5. 모델들의 조상님
Base = declarative_base()

# 6. DB 세션 가져오는 함수 (Dependency)

engine = create_engine(SQLALCHEMY_DATABASE_URL)

# 3. 세션 생성기
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. 모델들의 조상님
Base = declarative_base()

# 5. DB 세션 가져오는 함수 (Dependency)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()