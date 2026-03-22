from sqlalchemy import Column,Integer,String,Text
from app.core.database import Base
from sqlalchemy.orm import relationship

class OnboardingOptionsMaster(Base):
    __tablename__ = "onboarding_options_master"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(50))
    option_text = Column(Text)

class CategoryMaster(Base):
    __tablename__ = "category_master"
    id = Column(Integer,primary_key=True, index=True)
    category = Column(String(50))
    option_text = Column(Text)
    
class TitlesMaster(Base):
    __tablename__ = "titles_master"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50))
    description = Column(Text)
    requirement_count = Column(Integer)

# 캐릭터 마스터 (상점 및 장착용)

